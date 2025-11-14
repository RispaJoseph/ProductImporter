from rest_framework import serializers
from .models import Product, Webhook, ImportJob

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = "__all__"
        read_only_fields = ("sku_lower", "created_at", "updated_at")

class WebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = Webhook
        fields = "__all__"

class ImportJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportJob
        fields = "__all__"
        read_only_fields = ("status", "total_rows", "processed", "created_at", "error")
