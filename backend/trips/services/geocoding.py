"""Free-tier geocoding.

Uses LocationIQ when ``LOCATIONIQ_API_KEY`` is configured (recommended for
production — keyed quota, no shared-IP throttling). Falls back to the public
Nominatim instance otherwise. Both speak the same API. We rate-limit, cache
in-process, and honor ``Retry-After`` on 429.
"""

from __future__ import annotations

import threading
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


_RETRY_ATTEMPTS = 4
_BACKOFF_SECONDS = 2.0
_MIN_INTERVAL_SECONDS = 1.1

_rate_lock = threading.Lock()
_last_request_at = 0.0

_cache_lock = threading.Lock()
_cache: dict[str, GeoPoint] = {}


def _throttle() -> None:
    """Block until at least _MIN_INTERVAL_SECONDS has passed since last call."""
    global _last_request_at
    with _rate_lock:
        now = time.monotonic()
        wait = _MIN_INTERVAL_SECONDS - (now - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        _last_request_at = time.monotonic()


def _retry_after_seconds(resp: requests.Response, attempt: int) -> float:
    raw = resp.headers.get("Retry-After")
    if raw:
        try:
            return max(float(raw), _MIN_INTERVAL_SECONDS)
        except ValueError:
            pass
    return _BACKOFF_SECONDS * (2 ** attempt)


def geocode(query: str) -> GeoPoint:
    query = (query or "").strip()
    if not query:
        raise GeocodingError("Empty address")

    cache_key = query.lower()
    with _cache_lock:
        cached = _cache.get(cache_key)
    if cached is not None:
        return cached

    api_key = getattr(settings, "LOCATIONIQ_API_KEY", "") or ""
    if api_key:
        url = f"{settings.LOCATIONIQ_BASE_URL.rstrip('/')}/search"
    else:
        url = f"{settings.NOMINATIM_BASE_URL.rstrip('/')}/search"
    params = {
        "q": query,
        "format": "json",
        "limit": 1,
        "addressdetails": 0,
    }
    if api_key:
        params["key"] = api_key
    headers = {
        "User-Agent": settings.NOMINATIM_USER_AGENT,
        "Accept-Language": "en",
    }

    last_error: Exception | None = None
    resp = None
    for attempt in range(_RETRY_ATTEMPTS):
        _throttle()
        try:
            resp = requests.get(url, params=params, headers=headers, timeout=15)
            if resp.status_code == 429:
                if attempt < _RETRY_ATTEMPTS - 1:
                    time.sleep(_retry_after_seconds(resp, attempt))
                    continue
                raise GeocodingError(
                    "Geocoding service is rate-limiting requests; please retry shortly."
                )
            resp.raise_for_status()
            break
        except requests.RequestException as e:
            last_error = e
            if attempt < _RETRY_ATTEMPTS - 1:
                time.sleep(_BACKOFF_SECONDS * (2 ** attempt))
                continue
            raise GeocodingError(f"Geocoding service error: {e}") from e
    else:
        raise GeocodingError(f"Geocoding service error: {last_error}")

    data = resp.json()
    if not data:
        raise GeocodingError(f"Could not find location: '{query}'")

    top = data[0]
    try:
        point = GeoPoint(
            label=top.get("display_name", query),
            lat=float(top["lat"]),
            lon=float(top["lon"]),
        )
    except (KeyError, TypeError, ValueError) as e:
        raise GeocodingError(f"Malformed geocoding response: {e}") from e

    with _cache_lock:
        _cache[cache_key] = point
    return point
