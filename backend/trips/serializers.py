from rest_framework import serializers

from .models import Trip
from .services import hos_rules as R


class PlanTripInputSerializer(serializers.Serializer):
    current_location = serializers.CharField(max_length=255)
    pickup_location = serializers.CharField(max_length=255)
    dropoff_location = serializers.CharField(max_length=255)
    current_cycle_hours = serializers.FloatField(min_value=0, max_value=R.CYCLE_HOURS)


class TripSerializer(serializers.ModelSerializer):
    class Meta:
        model = Trip
        fields = [
            "id",
            "current_location",
            "pickup_location",
            "dropoff_location",
            "current_cycle_hours",
            "plan",
            "created_at",
        ]
        read_only_fields = ["id", "plan", "created_at"]
