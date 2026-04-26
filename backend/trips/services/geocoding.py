"""Free-tier geocoding via Nominatim (OpenStreetMap)."""

from __future__ import annotations

import time
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


_RETRY_ATTEMPTS = 3
_BACKOFF_SECONDS = 1.0


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

    last_error: Exception | None = None
    for attempt in range(_RETRY_ATTEMPTS):
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=15)
            if resp.status_code == 429 and attempt < _RETRY_ATTEMPTS - 1:
                time.sleep(_BACKOFF_SECONDS * (attempt + 1))
                continue
            resp.raise_for_status()
            break
        except requests.RequestException as e:
            last_error = e
            if attempt < _RETRY_ATTEMPTS - 1:
                time.sleep(_BACKOFF_SECONDS * (attempt + 1))
                continue
            raise GeocodingError(f"Geocoding service error: {e}") from e
    else:
        raise GeocodingError(f"Geocoding service error: {last_error}")

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
