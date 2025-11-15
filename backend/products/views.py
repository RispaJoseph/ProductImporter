from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response

from .models import Product, Webhook, ImportJob
from .serializers import ProductSerializer, WebhookSerializer, ImportJobSerializer
import uuid
import os


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("-updated_at")
    serializer_class = ProductSerializer
    # Keep SearchFilter if you also want ?search= support
    filter_backends = [filters.SearchFilter]
    search_fields = ["sku", "name", "description"]

    def get_queryset(self):
        """
        Make backend filters match the frontend query params:
        - ?q=        → search across sku, name, description
        - ?sku=      → filter by SKU (icontains)
        - ?name=     → filter by Name (icontains)
        - ?active=   → "true" / "false"
        """
        qs = super().get_queryset()
        params = self.request.query_params

        q = params.get("q")
        sku = params.get("sku")
        name = params.get("name")
        active = params.get("active")

        if q:
            qs = qs.filter(
                Q(sku__icontains=q)
                | Q(name__icontains=q)
                | Q(description__icontains=q)
            )

        if sku:
            qs = qs.filter(sku__icontains=sku)

        if name:
            qs = qs.filter(name__icontains=name)

        if active in ("true", "false"):
            qs = qs.filter(active=(active == "true"))

        return qs

    @action(detail=False, methods=["delete"], url_path="bulk-delete")
    def bulk_delete(self, request):
        """
        DELETE /api/products/bulk-delete/
        Deletes ALL products.
        """
        deleted_count, _ = Product.objects.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebhookViewSet(viewsets.ModelViewSet):
    """
    CRUD for webhooks + a custom `test` action.

    Frontend can:
    - GET /api/webhooks/                → list webhooks
    - POST /api/webhooks/               → create
    - PUT/PATCH /api/webhooks/<id>/     → edit
    - DELETE /api/webhooks/<id>/        → delete
    - POST /api/webhooks/<id>/test/     → enqueue a test call
    """

    queryset = Webhook.objects.all().order_by("-created_at")
    serializer_class = WebhookSerializer

    @action(detail=True, methods=["post"], url_path="test")
    def test(self, request, pk=None):
        """
        POST /api/webhooks/<id>/test/

        Body (optional):
        {
          "payload": {...custom payload...}
        }

        Returns 202 and queues a Celery task that will update:
        - last_status
        - last_response
        - last_response_time_ms
        """
        webhook = self.get_object()
        payload = request.data.get("payload")

        from .tasks import test_webhook_task

        test_webhook_task.delay(webhook.id, payload)
        return Response(
            {
                "detail": "Test webhook queued",
                "webhook_id": webhook.id,
            },
            status=status.HTTP_202_ACCEPTED,
        )


@api_view(["POST"])
def upload_csv(request):
    f = request.FILES.get("file")
    if not f:
        return Response(
            {"detail": "file required"}, status=status.HTTP_400_BAD_REQUEST
        )

    tmp_path = f"/tmp/{uuid.uuid4()}.csv"
    with open(tmp_path, "wb") as fh:
        for chunk in f.chunks():
            fh.write(chunk)

    job = ImportJob.objects.create(filename=tmp_path, status="queued")

    try:
        from .tasks import import_csv_task

        import_csv_task.delay(job.id, tmp_path)
    except Exception:
        # If Celery/worker is not running, still keep the job record
        pass

    serializer = ImportJobSerializer(job)
    return Response(serializer.data, status=status.HTTP_202_ACCEPTED)


@api_view(["GET"])
def import_status(request, job_id):
    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)
    serializer = ImportJobSerializer(job)
    return Response(serializer.data)
