from django.db import models


class Trip(models.Model):
    """A planned trip. We persist the inputs and the computed plan so trips can
    be shared via a URL without re-running geocoding/routing."""

    current_location = models.CharField(max_length=255)
    pickup_location = models.CharField(max_length=255)
    dropoff_location = models.CharField(max_length=255)
    current_cycle_hours = models.FloatField()
    plan = models.JSONField()

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Trip #{self.pk}: {self.pickup_location} → {self.dropoff_location}"
