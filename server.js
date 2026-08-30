/**
 * Dr Krishna Induvasi Hospital — Backend
 * Plain Node.js (no external dependencies). Serves the frontend from /public
 * and exposes a JSON API for the appointment booking form.
 *
 * Run:   node server.js
 * URL:   http://localhost:3000
 *
 * Data is persisted to data/appointments.json (created automatically).
 * Admin listing is protected by ADMIN_KEY (see below).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-me-admin-key';

const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const APPOINTMENTS_FILE = path.join(DATA_DIR, 'appointments.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
};

// ---------- storage helpers ----------

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(APPOINTMENTS_FILE)) fs.writeFileSync(APPOINTMENTS_FILE, '[]');
}

function readAppointments() {
  ensureDataFile();
  try {
    return JSON.parse(fs.readFileSync(APPOINTMENTS_FILE, 'utf8'));
  } catch {
    return [];
  }
}

// Very small write queue so two near-simultaneous bookings can't clobber
// each other's writes.
let writeChain = Promise.resolve();
function writeAppointments(list) {
  writeChain = writeChain.then(
    () => fs.promises.writeFile(APPOINTMENTS_FILE, JSON.stringify(list, null, 2))
  );
  return writeChain;
}

// ---------- validation ----------

const DOCTORS = new Set([
  'Dr. Krishna Induvasi (Paediatric Surgery)',
  'Dr. Roshnidevi Patil (Urology)',
  'No preference',
]);

const TIME_SLOTS = new Set(['Morning (9 AM - 12 PM)', 'Afternoon (12 PM - 4 PM)', 'Evening (4 PM - 8 PM)']);

function validateAppointment(body) {
  const errors = {};
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();
  const patientAge = String(body.patientAge || '').trim();
  const doctor = String(body.doctor || 'No preference').trim();
  const preferredDate = String(body.preferredDate || '').trim();
  const timeSlot = String(body.timeSlot || '').trim();
  const message = String(body.message || '').trim();

  if (name.length < 2) errors.name = 'Please enter the patient/guardian full name.';
  if (!/^[0-9+\-\s()]{7,15}$/.test(phone)) errors.phone = 'Please enter a valid phone number.';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.';
  if (patientAge === '' || isNaN(Number(patientAge)) || Number(patientAge) < 0 || Number(patientAge) > 120) {
    errors.patientAge = 'Please enter a valid age.';
  }
  if (!DOCTORS.has(doctor)) errors.doctor = 'Please select a valid doctor.';
  if (!preferredDate || isNaN(Date.parse(preferredDate))) {
    errors.preferredDate = 'Please choose a valid date.';
  } else {
    const chosen = new Date(preferredDate + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (chosen < today) errors.preferredDate = 'Preferred date cannot be in the past.';
  }
  if (!TIME_SLOTS.has(timeSlot)) errors.timeSlot = 'Please choose a preferred time slot.';
  if (message.length > 1000) errors.message = 'Message is too long (max 1000 characters).';

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    clean: { name, phone, email, patientAge, doctor, preferredDate, timeSlot, message },
  };
}

// ---------- request helpers ----------

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req, limitBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, filePath);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA-friendly fallback: serve index.html for unknown non-API routes
        fs.readFile(path.join(PUBLIC_DIR, 'index.html'), (err2, indexContent) => {
          if (err2) {
            res.writeHead(404);
            return res.end('Not found');
          }
          res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
          res.end(indexContent);
        });
        return;
      }
      res.writeHead(500);
      return res.end('Server error');
    }
    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- routes ----------

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key',
    });
    return res.end();
  }

  // POST /api/appointments — create a booking
  if (pathname === '/api/appointments' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      let body;
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        return sendJSON(res, 400, { ok: false, error: 'Invalid JSON body.' });
      }

      const { valid, errors, clean } = validateAppointment(body);
      if (!valid) return sendJSON(res, 422, { ok: false, errors });

      const appointment = {
        id: crypto.randomUUID(),
        ...clean,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };

      const list = readAppointments();
      list.push(appointment);
      await writeAppointments(list);

      return sendJSON(res, 201, {
        ok: true,
        message: 'Appointment request received. Our team will call you shortly to confirm.',
        appointment,
      });
    } catch (err) {
      return sendJSON(res, 500, { ok: false, error: 'Something went wrong. Please try again.' });
    }
  }

  // GET /api/appointments — admin listing, requires X-Admin-Key header
  if (pathname === '/api/appointments' && req.method === 'GET') {
    if (req.headers['x-admin-key'] !== ADMIN_KEY) {
      return sendJSON(res, 401, { ok: false, error: 'Unauthorized.' });
    }
    return sendJSON(res, 200, { ok: true, appointments: readAppointments() });
  }

  // PATCH /api/appointments/:id — admin: update status (confirmed/cancelled)
  if (pathname.startsWith('/api/appointments/') && req.method === 'PATCH') {
    if (req.headers['x-admin-key'] !== ADMIN_KEY) {
      return sendJSON(res, 401, { ok: false, error: 'Unauthorized.' });
    }
    const id = pathname.split('/').pop();
    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw || '{}');
      const list = readAppointments();
      const idx = list.findIndex((a) => a.id === id);
      if (idx === -1) return sendJSON(res, 404, { ok: false, error: 'Appointment not found.' });
      if (!['pending', 'confirmed', 'cancelled'].includes(body.status)) {
        return sendJSON(res, 422, { ok: false, error: 'Invalid status.' });
      }
      list[idx].status = body.status;
      await writeAppointments(list);
      return sendJSON(res, 200, { ok: true, appointment: list[idx] });
    } catch {
      return sendJSON(res, 400, { ok: false, error: 'Invalid request.' });
    }
  }

  // Everything else -> static frontend
  if (req.method === 'GET') {
    return serveStatic(req, res, pathname);
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  ensureDataFile();
  console.log(`Dr Krishna Induvasi Hospital site running at http://localhost:${PORT}`);
  console.log(`Admin key (for GET/PATCH /api/appointments): ${ADMIN_KEY}`);
});
