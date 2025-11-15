from django.db import models


class Product(models.Model):
    sku = models.CharField(max_length=128)
    sku_lower = models.CharField(max_length=128, editable=False, unique=True)
    name = models.CharField(max_length=512)
    description = models.TextField(blank=True, null=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.sku:
            self.sku_lower = self.sku.strip().lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.sku} - {self.name}"


class ImportJob(models.Model):
    STATUS_CHOICES = [
        ("queued", "Queued"),
        ("processing", "Processing"),
        ("done", "Done"),
        ("failed", "Failed"),
    ]
    filename = models.CharField(max_length=1024)
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="queued")
    total_rows = models.IntegerField(default=0)
    processed = models.IntegerField(default=0)
    error = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Job {self.id} - {self.status}"


class Webhook(models.Model):
    EVENT_TYPE_CHOICES = [
        ("import.completed", "Import completed"),
        # later: ("product.created", "Product created"), etc.
    ]

    # Friendly label for the UI
    name = models.CharField(max_length=128, blank=True, default="")

    url = models.URLField()
    enabled = models.BooleanField(default=True)
    event_type = models.CharField(
        max_length=64,
        choices=EVENT_TYPE_CHOICES,
        default="import.completed",
    )

    last_status = models.IntegerField(null=True, blank=True)
    last_response = models.TextField(null=True, blank=True)
    # time taken by the last request, in milliseconds
    last_response_time_ms = models.IntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        label = self.name or self.url
        status = "enabled" if self.enabled else "disabled"
        return f"[{self.event_type}] {label} ({status})"
