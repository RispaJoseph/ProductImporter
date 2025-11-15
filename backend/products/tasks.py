from celery import shared_task
from django.db import connection
from django.utils import timezone

from .models import ImportJob, Webhook

import csv
import os
import logging
from decimal import Decimal, InvalidOperation
import requests

from psycopg2.extras import execute_values

logger = logging.getLogger(__name__)


def _parse_price(val):
    if val is None:
        return None
    val = str(val).strip()
    if val == "":
        return None
    try:
        cleaned = val.replace(",", "")
        return Decimal(cleaned)
    except (InvalidOperation, ValueError):
        return None


def _parse_active(val):
    if val is None:
        return True
    v = str(val).strip().lower()
    if v in ("0", "false", "no", "f", "n"):
        return False
    if v in ("1", "true", "yes", "t", "y"):
        return True
    # default: treat unknown as True
    return True


@shared_task(bind=True)
def import_csv_task(self, job_id, filepath, chunk_size=5000):
    """
    Asynchronously import CSV at `filepath` for ImportJob(job_id).

    Expects CSV headers with at least: sku, name, description, price
    Optional header: active
    """
    job = None
    try:
        logger.info("Import task started: job_id=%s file=%s", job_id, filepath)
        job = ImportJob.objects.get(id=job_id)
        job.status = "processing"
        job.error = ""
        job.save(update_fields=["status", "error"])

        if not os.path.exists(filepath):
            raise FileNotFoundError(f"CSV file not found: {filepath}")

        # Count total lines (minus header)
        total = 0
        with open(filepath, "r", encoding="utf-8") as f:
            for _ in f:
                total += 1
        if total > 0:
            total -= 1  # exclude header
        job.total_rows = total
        job.processed = 0
        job.save(update_fields=["total_rows", "processed"])

        if total == 0:
            job.status = "done"
            job.save(update_fields=["status"])
            logger.info("Import finished: empty file job_id=%s", job_id)
            return

        processed = 0
        with open(filepath, "r", encoding="utf-8") as fh:
            # Handle possible BOM
            reader = csv.DictReader((line.lstrip("\ufeff") for line in fh))
            chunk = []

            for row in reader:
                sku = (row.get("sku") or "").strip()
                if not sku:
                    continue

                name = (row.get("name") or "")[:512]
                description = row.get("description") or ""
                price = _parse_price(row.get("price"))
                active = _parse_active(row.get("active"))
                sku_lower = sku.lower()

                # Prepare tuple matching our SQL VALUES order
                # (sku, sku_lower, name, description, price, active)
                chunk.append((sku, sku_lower, name, description, price, active))

                if len(chunk) >= chunk_size:
                    _bulk_upsert(chunk)
                    processed += len(chunk)
                    job.processed = processed
                    job.save(update_fields=["processed"])
                    logger.info(
                        "Imported chunk: job=%s processed=%d/%d",
                        job_id,
                        processed,
                        job.total_rows,
                    )
                    chunk = []

            # final chunk
            if chunk:
                _bulk_upsert(chunk)
                processed += len(chunk)
                job.processed = processed
                job.save(update_fields=["processed"])
                logger.info(
                    "Imported final chunk: job=%s processed=%d/%d",
                    job_id,
                    processed,
                    job.total_rows,
                )

        job.status = "done"
        job.save(update_fields=["status"])
        logger.info(
            "Import completed successfully: job_id=%s total=%d",
            job_id,
            job.total_rows,
        )

        # Notify webhooks
        send_webhooks.delay(
            "import.completed",
            {"job_id": job.id, "total": job.total_rows, "processed": job.processed},
        )

    except Exception as e:
        logger.exception("Import failed for job_id=%s: %s", job_id, e)
        if job:
            job.status = "failed"
            job.error = str(e)
            job.save(update_fields=["status", "error"])
        # re-raise for Celery monitoring
        raise


def _bulk_upsert(rows):
    """
    rows: list of tuples (sku, sku_lower, name, description, price, active)

    Uses a VALUES subquery so we can set created_at/updated_at to now()
    for each inserted row, and do a fast UPSERT on sku_lower.
    """
    if not rows:
        return

    with connection.cursor() as cur:
        sql = """
        INSERT INTO products_product (sku, sku_lower, name, description, price, active, created_at, updated_at)
        SELECT
          v.sku,
          v.sku_lower,
          v.name,
          v.description,
          v.price,
          v.active,
          now() AS created_at,
          now() AS updated_at
        FROM (VALUES %s) AS v(sku, sku_lower, name, description, price, active)
        ON CONFLICT (sku_lower) DO UPDATE SET
          sku = EXCLUDED.sku,
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          price = EXCLUDED.price,
          active = EXCLUDED.active,
          updated_at = now()
        """
        execute_values(cur, sql, rows)


@shared_task
def send_webhooks(event_type, payload):
    webhooks = Webhook.objects.filter(enabled=True, event_type=event_type)
    for wh in webhooks:
        try:
            r = requests.post(wh.url, json=payload, timeout=5)
            wh.last_status = r.status_code
            wh.last_response = (r.text or "")[:1000]
            wh.save(update_fields=["last_status", "last_response"])
        except Exception as e:
            wh.last_status = None
            wh.last_response = str(e)[:1000]
            wh.save(update_fields=["last_status", "last_response"])
