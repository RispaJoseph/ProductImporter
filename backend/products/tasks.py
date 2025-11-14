from celery import shared_task
from .models import ImportJob, Webhook
import csv, os, logging
from django.db import connection, transaction
from psycopg2.extras import execute_values
import requests
from decimal import Decimal, InvalidOperation

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
        job.save()

        
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"CSV file not found: {filepath}")

        
        total = 0
        with open(filepath, "r", encoding="utf-8") as f:
            for _ in f:
                total += 1
        if total > 0:
            total -= 1
        job.total_rows = total
        job.processed = 0
        job.save()

        if total == 0:
            job.status = "done"
            job.save()
            logger.info("Import finished: empty file job_id=%s", job_id)
            return

        processed = 0
        with open(filepath, "r", encoding="utf-8") as fh:
            
            reader = csv.DictReader((line.lstrip('\ufeff') for line in fh))
            chunk = []
            for row in reader:
                sku = (row.get("sku") or "").strip()
                if not sku:
                    continue
                name = (row.get("name") or "")[:512]
                description = row.get("description") or ""
                price = _parse_price(row.get("price"))
                sku_lower = sku.lower()
                active = _parse_active(row.get("active"))

                # Append tuple matching INSERT columns:
                # (sku, sku_lower, name, description, price, active)
                chunk.append((sku, sku_lower, name, description, price, active))

                if len(chunk) >= chunk_size:
                    try:
                        _bulk_upsert(chunk)
                    except Exception as e:
                        logger.exception("Bulk upsert failed on chunk: %s", e)
                        raise

                    processed += len(chunk)
                    job.processed = processed
                    job.save(update_fields=["processed"])
                    logger.info("Imported chunk: job=%s processed=%d/%d", job_id, processed, job.total_rows)
                    chunk = []

            
            if chunk:
                try:
                    _bulk_upsert(chunk)
                except Exception as e:
                    logger.exception("Bulk upsert failed on final chunk: %s", e)
                    raise
                processed += len(chunk)
                job.processed = processed
                job.save(update_fields=["processed"])
                logger.info("Imported final chunk: job=%s processed=%d/%d", job_id, processed, job.total_rows)

        job.status = "done"
        job.save(update_fields=["status"])
        logger.info("Import completed successfully: job_id=%s total=%d", job_id, job.total_rows)

        
        send_webhooks.delay("import.completed", {"job_id": job.id, "total": job.total_rows, "processed": job.processed})

    except Exception as e:
        logger.exception("Import failed for job_id=%s: %s", job_id, e)
        if job:
            job.status = "failed"
            job.error = str(e)
            job.save(update_fields=["status", "error"])
        
        raise


def _bulk_upsert(rows):
    """
    rows: list of tuples (sku, sku_lower, name, description, price, active)
    Uses a VALUES-list subquery so we can set created_at/updated_at = now()
    for each inserted row.
    """
    if not rows:
        return

    with connection.cursor() as cur:
        sql = """
        INSERT INTO products_product (sku, sku_lower, name, description, price, active, created_at, updated_at)
        SELECT v.sku, v.sku_lower, v.name, v.description, v.price, v.active, now() AS created_at, now() AS updated_at
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
