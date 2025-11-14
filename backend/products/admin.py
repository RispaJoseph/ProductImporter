from django.contrib import admin
from .models import Product, ImportJob, Webhook

# Register your models here.


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku", "name", "price", "active", "updated_at")
    search_fields = ("sku", "name", "description")
    list_filter = ("active",)

@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = ("id", "filename", "status", "total_rows", "processed", "created_at")
    readonly_fields = ("created_at", "error")

@admin.register(Webhook)
class WebhookAdmin(admin.ModelAdmin):
    list_display = ("url", "event_type", "enabled", "last_status", "created_at")
    readonly_fields = ("last_status", "last_response")