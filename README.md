# Dr Krishna Induvasi Hospital — Website

Front end (landing page) + back end (appointment booking API) for the hospital site.
No npm packages are required — the backend uses only Node.js's built-in modules.

## Structure

```
hospital-website/
├── public/
│   └── index.html      # Frontend: landing page + booking modal + JS
├── data/
│   └── appointments.json  # Created automatically — stores bookings
├── server.js            # Backend: static file server + JSON API
├── package.json
└── README.md
```

## Run it

```bash
node server.js
```

Then open **http://localhost:3000** in your browser. The "Book Appointment" /
"Book Consultation" buttons open a form that submits to the backend.

Optionally set a custom port or admin key:

```bash
PORT=4000 ADMIN_KEY=my-secret-key node server.js
```

## Frontend (input)

The booking modal (in `public/index.html`) collects:

- Patient / guardian name *
- Phone number *
- Patient age *
- Email (optional)
- Preferred doctor
- Preferred date *
- Preferred time slot *
- Reason for visit (optional)

`*` = required. Every "Book Appointment" and "Book Consultation" button on the
page opens this same form (the doctor field is pre-filled when a specific
doctor's "Book Consultation" button is used).

## Backend (API)

All responses are JSON.

### `POST /api/appointments`
Create a new appointment request.

```bash
curl -X POST http://localhost:3000/api/appointments \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anita Sharma",
    "phone": "+91 98765 43210",
    "email": "anita@example.com",
    "patientAge": "4",
    "doctor": "Dr. Krishna Induvasi (Paediatric Surgery)",
    "preferredDate": "2026-09-15",
    "timeSlot": "Morning (9 AM - 12 PM)",
    "message": "Follow-up consultation"
  }'
```

Validation errors come back as `422` with an `errors` object keyed by field
name. Successful bookings return `201` with the saved appointment (including
a generated `id` and `status: "pending"`).

### `GET /api/appointments`
Admin-only listing of all bookings. Requires the `X-Admin-Key` header to
match `ADMIN_KEY` (default `change-me-admin-key` — **change this before
deploying**).

```bash
curl http://localhost:3000/api/appointments -H "X-Admin-Key: change-me-admin-key"
```

### `PATCH /api/appointments/:id`
Admin-only. Update a booking's status to `pending`, `confirmed`, or
`cancelled`.

```bash
curl -X PATCH http://localhost:3000/api/appointments/<id> \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: change-me-admin-key" \
  -d '{"status": "confirmed"}'
```

## Storage

Bookings are stored in `data/appointments.json` (plain JSON, created on first
run). This is fine for a single small clinic; for higher volume or multiple
staff members updating records at once, swap `readAppointments` /
`writeAppointments` in `server.js` for a real database (SQLite, Postgres,
etc.) — the API surface stays the same.

## Notes for production use

- Change `ADMIN_KEY` via the environment variable before deploying.
- Consider adding rate limiting on `POST /api/appointments` to prevent spam.
- Consider wiring an SMS/email notification (e.g. via Twilio or an email API)
  inside the `POST /api/appointments` handler so staff are alerted instantly.
- Put this behind HTTPS (e.g. via a reverse proxy like Nginx or a host that
  terminates TLS for you) before going live.
