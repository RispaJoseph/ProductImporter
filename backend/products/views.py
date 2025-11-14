from rest_framework import viewsets, filters, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Product, Webhook, ImportJob
from .serializers import ProductSerializer, WebhookSerializer, ImportJobSerializer
import uuid, os

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all().order_by("-updated_at")
    serializer_class = ProductSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["sku", "name", "description"]

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
