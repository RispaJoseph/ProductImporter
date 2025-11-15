from django.db.models import Q
from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view, action
from rest_framework.response import Response

from .models import Product, Webhook, ImportJob
from .serializers import ProductSerializer, WebhookSerializer, ImportJobSerializer
import uuid, os


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("-updated_at")
    serializer_class = ProductSerializer
    # You can keep SearchFilter if you also want ?search= support
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

        Used by the frontend Bulk Delete feature.
        """
        deleted_count, _ = Product.objects.all().delete()
        # You *can* return the count if you want:
        # return Response({"deleted": deleted_count}, status=status.HTTP_200_OK)
        return Response(status=status.HTTP_204_NO_CONTENT)


class WebhookViewSet(viewsets.ModelViewSet):
    queryset = Webhook.objects.all()
    serializer_class = WebhookSerializer


@api_view(["POST"])
def upload_csv(request):
    f = request.FILES.get("file")
    if not f:
        return Response({"detail": "file required"}, status=status.HTTP_400_BAD_REQUEST)

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
