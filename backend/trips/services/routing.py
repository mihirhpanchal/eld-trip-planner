"""Routing via the public OSRM demo server. We ask for geojson so the frontend
can hand the polyline straight to react-leaflet."""

from __future__ import annotations

from dataclasses import dataclass

import requests
from django.conf import settings

from .geocoding import GeoPoint


METERS_PER_MILE = 1609.344


class RoutingError(Exception):
    pass


@dataclass
class Route:
    distance_miles: float
    duration_seconds: int
    geometry: list  # GeoJSON [lon, lat] pairs


def route_between(origin: GeoPoint, destination: GeoPoint) -> Route:
    base_url = settings.OSRM_BASE_URL.rstrip("/")
    coords = f"{origin.lon},{origin.lat};{destination.lon},{destination.lat}"
    url = f"{base_url}/route/v1/driving/{coords}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "steps": "false",
        "alternatives": "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise RoutingError(f"Routing service error: {e}") from e

    data = resp.json()
    if data.get("code") != "Ok" or not data.get("routes"):
        raise RoutingError(
            f"Routing failed: {data.get('message') or data.get('code')}"
        )

    route = data["routes"][0]
    distance_m = float(route["distance"])
    duration_s = float(route["duration"])
    # OSRM's profile assumes a car. Bump duration ~15% so the HOS timeline
    # reflects a loaded truck averaging ~55 mph instead of ~65.
    adjusted_duration = int(duration_s * 1.15)
    geometry = route.get("geometry", {}).get("coordinates", [])

    return Route(
        distance_miles=round(distance_m / METERS_PER_MILE, 1),
        duration_seconds=max(adjusted_duration, 60),
        geometry=geometry,
    )
