from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404

from .models import Trip
from .serializers import PlanTripInputSerializer, TripSerializer
from .services.geocoding import geocode, GeocodingError
from .services.routing import route_between, RoutingError
from .services.hos_planner import HOSPlanner, Leg
from .services.log_builder import build_daily_logs


@api_view(["POST"])
def plan_trip(request):
    serializer = PlanTripInputSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        current = geocode(data["current_location"])
        pickup = geocode(data["pickup_location"])
        dropoff = geocode(data["dropoff_location"])
    except GeocodingError as e:
        return Response(
            {"detail": str(e), "stage": "geocoding"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        leg1_route = route_between(current, pickup)
        leg2_route = route_between(pickup, dropoff)
    except RoutingError as e:
        return Response(
            {"detail": str(e), "stage": "routing"},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    legs = [
        Leg(
            origin_label=current.label,
            destination_label=pickup.label,
            origin_lat=current.lat,
            origin_lon=current.lon,
            dest_lat=pickup.lat,
            dest_lon=pickup.lon,
            distance_miles=leg1_route.distance_miles,
            duration_seconds=leg1_route.duration_seconds,
            geometry=leg1_route.geometry,
        ),
        Leg(
            origin_label=pickup.label,
            destination_label=dropoff.label,
            origin_lat=pickup.lat,
            origin_lon=pickup.lon,
            dest_lat=dropoff.lat,
            dest_lon=dropoff.lon,
            distance_miles=leg2_route.distance_miles,
            duration_seconds=leg2_route.duration_seconds,
            geometry=leg2_route.geometry,
        ),
    ]

    planner = HOSPlanner(legs, current_cycle_hours_used=data["current_cycle_hours"])
    result = planner.plan()

    daily_logs = build_daily_logs(result.segments)

    plan_payload = {
        "inputs": {
            "current_location": data["current_location"],
            "pickup_location": data["pickup_location"],
            "dropoff_location": data["dropoff_location"],
            "current_cycle_hours": data["current_cycle_hours"],
        },
        "geocoded": {
            "current": {"label": current.label, "lat": current.lat, "lon": current.lon},
            "pickup": {"label": pickup.label, "lat": pickup.lat, "lon": pickup.lon},
            "dropoff": {"label": dropoff.label, "lat": dropoff.lat, "lon": dropoff.lon},
        },
        "legs": [leg.to_dict() for leg in legs],
        "segments": [s.to_dict() for s in result.segments],
        "daily_logs": daily_logs,
        "totals": {
            "miles": result.total_miles,
            "driving_seconds": result.total_driving_seconds,
            "on_duty_seconds": result.total_on_duty_seconds,
            "trip_start": result.trip_start.isoformat() if result.trip_start else None,
            "trip_end": result.trip_end.isoformat() if result.trip_end else None,
            "days": len(daily_logs),
        },
    }

    trip = Trip.objects.create(
        current_location=data["current_location"],
        pickup_location=data["pickup_location"],
        dropoff_location=data["dropoff_location"],
        current_cycle_hours=data["current_cycle_hours"],
        plan=plan_payload,
    )

    return Response({"id": trip.id, **plan_payload}, status=status.HTTP_200_OK)


@api_view(["GET"])
def trip_detail(request, pk):
    trip = get_object_or_404(Trip, pk=pk)
    return Response(TripSerializer(trip).data)
