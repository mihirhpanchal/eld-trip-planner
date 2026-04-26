# ELD Trip Planner

Full-stack app that takes trip details, applies FMCSA Hours-of-Service rules,
returns a routed map with required stops, and draws filled-out daily log sheets.

- **Backend:** Django 5 + DRF (Python 3.11+)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind + react-leaflet
- **Routing:** OSRM public demo server (free, no API key)
- **Geocoding:** Nominatim / OpenStreetMap (free, no API key)

## Inputs / Outputs

**Inputs**
- Current location
- Pickup location
- Drop-off location
- Current cycle hours used (0–70)

**Outputs**
- Interactive map with the two driving legs and colored markers for start /
  pickup / drop-off / fuel stops / 30-min breaks / 10-hour resets
- One or more filled-out Daily Log Sheets (SVG, pixel-close to the paper form),
  with a drawn duty-status line, remarks at each change, and per-row totals

## HOS rules applied

- 11-hour driving limit per shift
- 14-hour on-duty window per shift
- 30-minute break after 8 cumulative driving hours
- 10 consecutive hours off-duty to reset a shift
- 70 hours / 8 days cycle (with a 34-hour restart if the cycle is exhausted)
- Fuel stop (15 min On Duty) at least every 1,000 miles
- 1 hour On Duty at pickup, 1 hour at drop-off

## Running locally

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver   # -> http://127.0.0.1:8000
```

Backend tests:
```bash
python manage.py test trips
```

### Frontend
```bash
cd frontend
npm install
npm run dev                  # -> http://localhost:5173
```

By default the frontend points at `http://127.0.0.1:8000`. Override with
`VITE_API_BASE_URL` in `frontend/.env`.

## API

`POST /api/plan-trip/`

```json
{
  "current_location": "Los Angeles, CA",
  "pickup_location": "Las Vegas, NV",
  "dropoff_location": "Denver, CO",
  "current_cycle_hours": 10
}
```

Returns `{ id, inputs, geocoded, legs, segments, daily_logs, totals }`.

`GET /api/trips/<id>/` — retrieve a previously computed plan.

## Deployment

- **Frontend → Vercel.** Import the `frontend/` directory; Vite is auto-detected.
  Set `VITE_API_BASE_URL` to your backend URL.
- **Backend → Render / Railway.** A `render.yaml` is included. Set
  `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` to your Vercel URL.

### Env vars

Backend — see [`backend/.env.example`](backend/.env.example):
`SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`,
`CSRF_TRUSTED_ORIGINS`, optional `DATABASE_URL`.

Frontend — see [`frontend/.env.example`](frontend/.env.example):
`VITE_API_BASE_URL`.

## Repo layout

```
eld-trip-planner/
├── backend/
│   ├── eld/                    # Django project (settings, urls, wsgi)
│   ├── trips/                  # app
│   │   ├── models.py           # Trip (inputs + computed plan JSON)
│   │   ├── views.py            # /api/plan-trip/, /api/trips/<id>/
│   │   ├── serializers.py
│   │   ├── tests.py            # HOS + log-builder tests
│   │   └── services/
│   │       ├── hos_rules.py    # constants (11h, 14h, 30min, 70h, ...)
│   │       ├── hos_planner.py  # walks legs, inserts breaks/rests/fuel
│   │       ├── log_builder.py  # slices timeline into per-day logs
│   │       ├── geocoding.py    # Nominatim client
│   │       └── routing.py      # OSRM client
│   ├── requirements.txt
│   ├── build.sh
│   ├── render.yaml
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   │   ├── TripForm.tsx
    │   │   ├── RouteMap.tsx
    │   │   ├── DailyLogSheet.tsx     # SVG log sheet
    │   │   └── LogSheetViewer.tsx
    │   └── lib/ (api.ts, types.ts, format.ts)
    ├── vercel.json
    └── .env.example
```

## Design notes

- The HOS planner is pure Python and fully unit-tested. The timeline it
  produces is deterministic, second-accurate, and independent of the routing
  provider — swapping OSRM for Mapbox or a truck-specific engine is localised
  to `routing.py`.
- Log sheets are rendered as a single SVG `<path>` step function, which makes
  them crisp at any zoom, easy to print, and fast.
- OSRM's car profile is adjusted +15% for loaded-truck realism. Override
  `OSRM_BASE_URL` to point at a truck-specific OSRM instance if available.
