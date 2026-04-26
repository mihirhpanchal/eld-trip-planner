"""Free-tier geocoding via Nominatim (OpenStreetMap)."""

from __future__ import annotations

from dataclasses import dataclass

import requests
from django.conf import settings


class GeocodingError(Exception):
    pass


@dataclass
class GeoPoint:
    label: str
    lat: float
    lon: float


def geocode(query: str) -> GeoPoint:
    query = (query or "").strip()
    if not query:
        raise GeocodingError("Empty address")

    url = f"{settings.NOMINATIM_BASE_URL.rstrip('/')}/search"
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "addressdetails": 0,
    }
    headers = {
        "User-Agent": settings.NOMINATIM_USER_AGENT,
        "Accept-Language": "en",
    }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=15)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise GeocodingError(f"Geocoding service error: {e}") from e

    data = resp.json()
    if not data:
        raise GeocodingError(f"Could not find location: '{query}'")

    top = data[0]
    try:
        return GeoPoint(
            label=top.get("display_name", query),
            lat=float(top["lat"]),
            lon=float(top["lon"]),
        )
    except (KeyError, TypeError, ValueError) as e:
        raise GeocodingError(f"Malformed geocoding response: {e}") from e
