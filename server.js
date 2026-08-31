/**
 * Dr Krishna Induvasi Hospital — Backend
 *
 * Plain Node.js backend
 * Serves frontend from /public
 * Provides JSON API for appointment booking
 * Stores appointments in data/appointments.json
 *
 * Run:
 *   node server.js
 *
 * URL:
 *   http://localhost:3000
 *
 * Email notifications:
 *   Uses Nodemailer + SMTP
 *
 * Install:
 *   npm install nodemailer
 *
 * Recommended environment variables:
 *
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=465
 *   SMTP_SECURE=true
 *   SMTP_USER=your-email@gmail.com
 *   SMTP_PASS=your-gmail-app-password
 *   NOTIFICATION_EMAIL=raok4300@gmail.com
 *
 * IMPORTANT:
 * Do NOT put your Gmail password directly in this file.
 * Use a Gmail App Password.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ------------------------------------------------------------
// Optional email dependency
// ------------------------------------------------------------

let nodemailer = null;

try {
  nodemailer = require("nodemailer");
} catch (error) {
  console.warn(
    "Nodemailer is not installed. Email notifications will be disabled."
  );
  console.warn("Install it with: npm install nodemailer");
}

// ------------------------------------------------------------
// Configuration
// ------------------------------------------------------------

const PORT = process.env.PORT || 3000;

const HOST = process.env.HOST || "0.0.0.0";

const PUBLIC_DIR = path.join(__dirname, "public");

const DATA_DIR = path.join(__dirname, "data");

const APPOINTMENTS_FILE = path.join(
  DATA_DIR,
  "appointments.json"
);

// Hospital details
const HOSPITAL_NAME =
  "Dr Krishna Induvasi Paediatric Surgery & Urology Hospital";

const DOCTOR_NAME =
  "Dr Krishna Induvasi";

const DOCTOR_TITLE =
  "Paediatric Surgeon & Paediatric Urologist";

const HOSPITAL_CITY =
  "Kalaburagi, Karnataka";

const HOSPITAL_PHONE =
  "+91 63610 90667";

const WHATSAPP_NUMBER =
  "916361090667";

// Email that receives appointment notifications
const NOTIFICATION_EMAIL =
  process.env.NOTIFICATION_EMAIL ||
  "raok4300@gmail.com";

// ------------------------------------------------------------
// SMTP configuration
// ------------------------------------------------------------

const SMTP_HOST =
  process.env.SMTP_HOST || "smtp.gmail.com";

const SMTP_PORT =
  Number(process.env.SMTP_PORT || 465);

const SMTP_SECURE =
  String(
    process.env.SMTP_SECURE || "true"
  ).toLowerCase() === "true";

const SMTP_USER =
  process.env.SMTP_USER || "";

const SMTP_PASS =
  process.env.SMTP_PASS || "";

// ------------------------------------------------------------
// Allowed appointment values
// ------------------------------------------------------------

const ALLOWED_DOCTORS = [
  "Dr Krishna Induvasi",
  "Dr. Krishna Induvasi",
  "Krishna Induvasi",
  "Paediatric Surgeon",
  "Pediatric Surgeon"
];

const ALLOWED_TIME_SLOTS = [
  "09:00 AM - 10:00 AM",
  "10:00 AM - 11:00 AM",
  "11:00 AM - 12:00 PM",
  "12:00 PM - 01:00 PM",
  "01:00 PM - 02:00 PM",
  "02:00 PM - 03:00 PM",
  "03:00 PM - 04:00 PM",
  "04:00 PM - 05:00 PM",
  "05:00 PM - 06:00 PM",
  "06:00 PM - 07:00 PM",
  "07:00 PM - 08:00 PM"
];

// ------------------------------------------------------------
// MIME types
// ------------------------------------------------------------

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8"
};

// ------------------------------------------------------------
// Ensure data directory exists
// ------------------------------------------------------------

function ensureDataDirectory() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
      recursive: true
    });
  }

  if (!fs.existsSync(APPOINTMENTS_FILE)) {
    fs.writeFileSync(
      APPOINTMENTS_FILE,
      "[]",
      "utf8"
    );
  }
}

// ------------------------------------------------------------
// Read appointments
// ------------------------------------------------------------

function readAppointments() {
  ensureDataDirectory();

  try {
    const raw = fs.readFileSync(
      APPOINTMENTS_FILE,
      "utf8"
    );

    if (!raw.trim()) {
      return [];
    }

    const data = JSON.parse(raw);

    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(
      "Could not read appointments:",
      error
    );

    return [];
  }
}

// ------------------------------------------------------------
// Write appointments
// ------------------------------------------------------------

function writeAppointments(appointments) {
  ensureDataDirectory();

  const tempFile =
    APPOINTMENTS_FILE + ".tmp";

  fs.writeFileSync(
    tempFile,
    JSON.stringify(
      appointments,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    tempFile,
    APPOINTMENTS_FILE
  );
}

// ------------------------------------------------------------
// Generate appointment ID
// ------------------------------------------------------------

function generateAppointmentId() {
  const date = new Date();

  const datePart =
    date
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const randomPart =
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();

  return `DKI-${datePart}-${randomPart}`;
}

// ------------------------------------------------------------
// Basic HTML escaping
// ------------------------------------------------------------

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ------------------------------------------------------------
// Clean incoming text
// ------------------------------------------------------------

function cleanText(value, maxLength = 500) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value)
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

// ------------------------------------------------------------
// Email validation
// ------------------------------------------------------------

function isValidEmail(email) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ------------------------------------------------------------
// Phone validation
// ------------------------------------------------------------

function isValidPhone(phone) {
  const digits =
    String(phone || "").replace(/\D/g, "");

  return digits.length >= 10 &&
    digits.length <= 15;
}

// ------------------------------------------------------------
// Date validation
// ------------------------------------------------------------

function isValidDate(dateString) {
  if (!dateString) {
    return false;
  }

  const date =
    new Date(dateString);

  return !Number.isNaN(
    date.getTime()
  );
}

// ------------------------------------------------------------
// Email transporter
// ------------------------------------------------------------

function createEmailTransporter() {
  if (!nodemailer) {
    return null;
  }

  if (!SMTP_USER || !SMTP_PASS) {
    console.warn(
      "SMTP_USER or SMTP_PASS is not configured."
    );

    return null;
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

const emailTransporter =
  createEmailTransporter();

// ------------------------------------------------------------
// Email configuration status
// ------------------------------------------------------------

function emailIsConfigured() {
  return Boolean(
    nodemailer &&
    emailTransporter &&
    SMTP_USER &&
    SMTP_PASS &&
    NOTIFICATION_EMAIL
  );
}

// ------------------------------------------------------------
// Appointment email - hospital
// ------------------------------------------------------------

async function sendHospitalAppointmentEmail(
  appointment
) {
  if (!emailIsConfigured()) {
    console.warn(
      "Hospital appointment email skipped: SMTP not configured."
    );

    return {
      sent: false,
      reason: "SMTP not configured"
    };
  }

  const subject =
    `New Appointment — ${appointment.patientName} — ${appointment.appointmentId}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>New Appointment</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f7fb;
  font-family:Arial,Helvetica,sans-serif;
">

<div style="
  max-width:650px;
  margin:30px auto;
  background:#ffffff;
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 4px 20px rgba(0,0,0,0.08);
">

  <div style="
    background:#0b6e69;
    color:#ffffff;
    padding:25px;
  ">

    <h1 style="
      margin:0 0 8px 0;
      font-size:24px;
    ">
      New Appointment Request
    </h1>

    <p style="
      margin:0;
      font-size:15px;
    ">
      ${escapeHtml(HOSPITAL_NAME)}
    </p>

  </div>

  <div style="padding:25px;">

    <p>
      A new appointment has been submitted through the hospital website.
    </p>

    <table style="
      width:100%;
      border-collapse:collapse;
      margin-top:20px;
    ">

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Appointment ID
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.appointmentId)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Patient Name
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.patientName)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Phone
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.phone)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Email
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.email || "Not provided")}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Patient Age
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.patientAge || "Not provided")}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Doctor
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.doctor)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Preferred Date
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.preferredDate)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;font-weight:bold;">
          Time Slot
        </td>
        <td style="padding:10px;border-bottom:1px solid #eee;">
          ${escapeHtml(appointment.timeSlot)}
        </td>
      </tr>

      <tr>
        <td style="padding:10px;font-weight:bold;">
          Message
        </td>
        <td style="padding:10px;">
          ${escapeHtml(appointment.message || "No message")}
        </td>
      </tr>

    </table>

    <div style="
      margin-top:25px;
      padding:15px;
      background:#f0f8f7;
      border-radius:8px;
    ">

      <strong>Patient contact:</strong><br>

      <a href="tel:${escapeHtml(appointment.phone)}">
        ${escapeHtml(appointment.phone)}
      </a>

      ${
        appointment.email
          ? `<br>
             <a href="mailto:${escapeHtml(appointment.email)}">
               ${escapeHtml(appointment.email)}
             </a>`
          : ""
      }

    </div>

  </div>

  <div style="
    padding:18px 25px;
    background:#f8f8f8;
    color:#666;
    font-size:12px;
  ">
    ${escapeHtml(HOSPITAL_NAME)}<br>
    ${escapeHtml(HOSPITAL_CITY)}<br>
    Emergency / Contact: ${escapeHtml(HOSPITAL_PHONE)}
  </div>

</div>

</body>
</html>
`;

  const text = `
NEW APPOINTMENT REQUEST

Hospital:
${HOSPITAL_NAME}

Appointment ID:
${appointment.appointmentId}

Patient Name:
${appointment.patientName}

Phone:
${appointment.phone}

Email:
${appointment.email || "Not provided"}

Patient Age:
${appointment.patientAge || "Not provided"}

Doctor:
${appointment.doctor}

Preferred Date:
${appointment.preferredDate}

Time Slot:
${appointment.timeSlot}

Message:
${appointment.message || "No message"}

Hospital Contact:
${HOSPITAL_PHONE}
`;

  try {
    const info =
      await emailTransporter.sendMail({
        from: `"${HOSPITAL_NAME}" <${SMTP_USER}>`,
        to: NOTIFICATION_EMAIL,
        subject,
        text,
        html
      });

    console.log(
      "Hospital appointment email sent:",
      info.messageId
    );

    return {
      sent: true,
      messageId: info.messageId
    };

  } catch (error) {

    console.error(
      "Failed to send hospital appointment email:",
      error
    );

    return {
      sent: false,
      reason: error.message
    };
  }
}

// ------------------------------------------------------------
// Patient confirmation email
// ------------------------------------------------------------

async function sendPatientConfirmationEmail(
  appointment
) {
  if (!appointment.email) {
    return {
      sent: false,
      reason: "Patient email not provided"
    };
  }

  if (!emailIsConfigured()) {
    console.warn(
      "Patient confirmation email skipped: SMTP not configured."
    );

    return {
      sent: false,
      reason: "SMTP not configured"
    };
  }

  const subject =
    `Appointment Request Received — ${HOSPITAL_NAME}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Appointment Confirmation</title>
</head>

<body style="
  margin:0;
  padding:0;
  background:#f4f7fb;
  font-family:Arial,Helvetica,sans-serif;
">

<div style="
  max-width:650px;
  margin:30px auto;
  background:#ffffff;
  border-radius:12px;
  overflow:hidden;
  box-shadow:0 4px 20px rgba(0,0,0,0.08);
">

  <div style="
    background:#0b6e69;
    color:#ffffff;
    padding:25px;
  ">

    <h1 style="margin:0 0 8px 0;">
      Appointment Request Received
    </h1>

    <p style="margin:0;">
      ${escapeHtml(HOSPITAL_NAME)}
    </p>

  </div>

  <div style="padding:25px;">

    <p>
      Dear ${escapeHtml(appointment.patientName)},
    </p>

    <p>
      Thank you for contacting
      <strong>${escapeHtml(HOSPITAL_NAME)}</strong>.
    </p>

    <p>
      We have received your appointment request.
      Our hospital team will contact you to confirm the appointment.
    </p>

    <div style="
      background:#f0f8f7;
      padding:18px;
      border-radius:8px;
      margin:20px 0;
    ">

      <p>
        <strong>Appointment ID:</strong>
        ${escapeHtml(appointment.appointmentId)}
      </p>

      <p>
        <strong>Doctor:</strong>
        ${escapeHtml(appointment.doctor)}
      </p>

      <p>
        <strong>Preferred Date:</strong>
        ${escapeHtml(appointment.preferredDate)}
      </p>

      <p>
        <strong>Preferred Time:</strong>
        ${escapeHtml(appointment.timeSlot)}
      </p>

    </div>

    <p>
      <strong>Please note:</strong>
      This email confirms receipt of your request and
      does not by itself constitute final appointment confirmation.
    </p>

    <p>
      For urgent medical concerns, please contact the hospital directly.
    </p>

    <p>
      Regards,<br>
      <strong>${escapeHtml(DOCTOR_NAME)}</strong><br>
      ${escapeHtml(DOCTOR_TITLE)}<br>
      ${escapeHtml(HOSPITAL_NAME)}<br>
      ${escapeHtml(HOSPITAL_CITY)}<br>
      Contact: ${escapeHtml(HOSPITAL_PHONE)}
    </p>

  </div>

</div>

</body>
</html>
`;

  const text = `
Dear ${appointment.patientName},

Thank you for contacting ${HOSPITAL_NAME}.

We have received your appointment request.

Appointment ID:
${appointment.appointmentId}

Doctor:
${appointment.doctor}

Preferred Date:
${appointment.preferredDate}

Preferred Time:
${appointment.timeSlot}

Our hospital team will contact you to confirm the appointment.

Please note that this email confirms receipt of your request and does not by itself constitute final appointment confirmation.

For urgent medical concerns, please contact:
${HOSPITAL_PHONE}

Regards,

${DOCTOR_NAME}
${DOCTOR_TITLE}
${HOSPITAL_NAME}
${HOSPITAL_CITY}
`;

  try {

    const info =
      await emailTransporter.sendMail({
        from: `"${HOSPITAL_NAME}" <${SMTP_USER}>`,
        to: appointment.email,
        subject,
        text,
        html
      });

    console.log(
      "Patient confirmation email sent:",
      info.messageId
    );

    return {
      sent: true,
      messageId: info.messageId
    };

  } catch (error) {

    console.error(
      "Failed to send patient confirmation email:",
      error
    );

    return {
      sent: false,
      reason: error.message
    };
  }
}

// ------------------------------------------------------------
// Send both appointment emails
// ------------------------------------------------------------

async function sendAppointmentNotifications(
  appointment
) {
  const hospitalEmail =
    await sendHospitalAppointmentEmail(
      appointment
    );

  const patientEmail =
    await sendPatientConfirmationEmail(
      appointment
    );

  return {
    hospitalEmail,
    patientEmail
  };
}

// ------------------------------------------------------------
// Parse JSON request body
// ------------------------------------------------------------

function parseJsonBody(req) {
  return new Promise(
    (resolve, reject) => {

      let body = "";

      let bodySize = 0;

      const MAX_BODY_SIZE =
        1024 * 1024;

      req.on("data", chunk => {

        bodySize += chunk.length;

        if (bodySize > MAX_BODY_SIZE) {
          reject(
            new Error(
              "Request body too large"
            )
          );

          req.destroy();

          return;
        }

        body += chunk.toString();
      });

      req.on("end", () => {

        if (!body.trim()) {
          resolve({});
          return;
        }

        try {
          resolve(
            JSON.parse(body)
          );
        } catch (error) {
          reject(
            new Error(
              "Invalid JSON"
            )
          );
        }
      });

      req.on("error", error => {
        reject(error);
      });
    }
  );
}

// ------------------------------------------------------------
// JSON response helper
// ------------------------------------------------------------

function sendJson(
  res,
  statusCode,
  data
) {
  const json =
    JSON.stringify(data);

  res.writeHead(
    statusCode,
    {
      "Content-Type":
        "application/json; charset=utf-8",

      "Access-Control-Allow-Origin":
        "*",

      "Access-Control-Allow-Methods":
        "GET, POST, OPTIONS",

      "Access-Control-Allow-Headers":
        "Content-Type",

      "Cache-Control":
        "no-store"
    }
  );

  res.end(json);
}

// ------------------------------------------------------------
// Validate appointment
// ------------------------------------------------------------

function validateAppointment(body) {

  const name =
    cleanText(
      body.name,
      100
    );

  const phone =
    cleanText(
      body.phone,
      30
    );

  const email =
    cleanText(
      body.email,
      150
    );

  const patientAge =
    cleanText(
      body.patientAge,
      30
    );

  const doctor =
    cleanText(
      body.doctor,
      100
    );

  const preferredDate =
    cleanText(
      body.preferredDate,
      50
    );

  const timeSlot =
    cleanText(
      body.timeSlot,
      100
    );

  const message =
    cleanText(
      body.message,
      1000
    );

  const errors = [];

  if (!name) {
    errors.push(
      "Patient name is required."
    );
  }

  if (!phone) {
    errors.push(
      "Phone number is required."
    );
  } else if (!isValidPhone(phone)) {
    errors.push(
      "Please enter a valid phone number."
    );
  }

  if (
    email &&
    !isValidEmail(email)
  ) {
    errors.push(
      "Please enter a valid email address."
    );
  }

  if (!preferredDate) {
    errors.push(
      "Preferred date is required."
    );
  } else if (
    !isValidDate(preferredDate)
  ) {
    errors.push(
      "Please enter a valid preferred date."
    );
  }

  if (!doctor) {
    errors.push(
      "Doctor selection is required."
    );
  } else {

    const doctorIsValid =
      ALLOWED_DOCTORS.some(
        allowed =>
          allowed.toLowerCase() ===
          doctor.toLowerCase()
      );

    if (!doctorIsValid) {
      errors.push(
        "Invalid doctor selection."
      );
    }
  }

  if (!timeSlot) {
    errors.push(
      "Preferred time slot is required."
    );
  } else if (
    !ALLOWED_TIME_SLOTS.includes(
      timeSlot
    )
  ) {
    errors.push(
      "Invalid time slot."
    );
  }

  return {
    valid:
      errors.length === 0,

    errors,

    appointment: {
      patientName: name,
      phone,
      email,
      patientAge,
      doctor,
      preferredDate,
      timeSlot,
      message
    }
  };
}

// ------------------------------------------------------------
// Handle appointment POST
// ------------------------------------------------------------

async function handleAppointment(
  req,
  res
) {

  try {

    const body =
      await parseJsonBody(req);

    const validation =
      validateAppointment(body);

    if (!validation.valid) {

      sendJson(
        res,
        400,
        {
          success: false,
          message:
            "Please correct the following errors.",
          errors:
            validation.errors
        }
      );

      return;
    }

    const appointment =
      validation.appointment;

    const appointmentId =
      generateAppointmentId();

    const createdAt =
      new Date().toISOString();

    const record = {

      id: appointmentId,

      appointmentId,

      status: "pending",

      createdAt,

      patientName:
        appointment.patientName,

      phone:
        appointment.phone,

      email:
        appointment.email,

      patientAge:
        appointment.patientAge,

      doctor:
        appointment.doctor,

      preferredDate:
        appointment.preferredDate,

      timeSlot:
        appointment.timeSlot,

      message:
        appointment.message
    };

    const appointments =
      readAppointments();

    appointments.push(record);

    writeAppointments(
      appointments
    );

    console.log(
      `New appointment received: ${appointmentId}`
    );

    // --------------------------------------------------------
    // Send email notifications
    // --------------------------------------------------------

    let emailResult = null;

    try {

      emailResult =
        await sendAppointmentNotifications(
          record
        );

    } catch (emailError) {

      console.error(
        "Appointment email process failed:",
        emailError
      );

      emailResult = {
        hospitalEmail: {
          sent: false,
          reason: emailError.message
        },

        patientEmail: {
          sent: false,
          reason: emailError.message
        }
      };
    }

    // --------------------------------------------------------
    // Respond to frontend
    // --------------------------------------------------------

    sendJson(
      res,
      201,
      {
        success: true,

        message:
          "Your appointment request has been received successfully.",

        appointmentId,

        appointment: {
          id: appointmentId,

          patientName:
            record.patientName,

          doctor:
            record.doctor,

          preferredDate:
            record.preferredDate,

          timeSlot:
            record.timeSlot,

          status:
            record.status,

          createdAt:
            record.createdAt
        },

        notifications: {
          emailConfigured:
            emailIsConfigured(),

          hospitalEmailSent:
            Boolean(
              emailResult &&
              emailResult.hospitalEmail &&
              emailResult.hospitalEmail.sent
            ),

          patientEmailSent:
            Boolean(
              emailResult &&
              emailResult.patientEmail &&
              emailResult.patientEmail.sent
            )
        }
      }
    );

  } catch (error) {

    console.error(
      "Appointment processing error:",
      error
    );

    sendJson(
      res,
      500,
      {
        success: false,
        message:
          "Unable to process your appointment request right now. Please call the hospital directly.",
        contact:
          HOSPITAL_PHONE
      }
    );
  }
}

// ------------------------------------------------------------
// Serve static files
// ------------------------------------------------------------

function serveStaticFile(
  req,
  res
) {

  let requestPath =
    decodeURIComponent(
      req.url.split("?")[0]
    );

  if (
    requestPath === "/" ||
    requestPath === ""
  ) {
    requestPath =
      "/index.html";
  }

  // Prevent path traversal
  const safePath =
    path.normalize(
      requestPath
    );

  if (
    safePath.includes("..")
  ) {

    res.writeHead(
      403,
      {
        "Content-Type":
          "text/plain; charset=utf-8"
      }
    );

    res.end(
      "Forbidden"
    );

    return;
  }

  const filePath =
    path.join(
      PUBLIC_DIR,
      safePath
    );

  // Ensure requested path stays inside PUBLIC_DIR
  const publicRoot =
    path.resolve(
      PUBLIC_DIR
    );

  const resolvedPath =
    path.resolve(
      filePath
    );

  if (
    !resolvedPath.startsWith(
      publicRoot
    )
  ) {

    res.writeHead(
      403,
      {
        "Content-Type":
          "text/plain; charset=utf-8"
      }
    );

    res.end(
      "Forbidden"
    );

    return;
  }

  fs.stat(
    resolvedPath,
    (error, stats) => {

      if (error) {

        // SPA fallback
        if (
          path.extname(
            requestPath
          ) === ""
        ) {

          const indexPath =
            path.join(
              PUBLIC_DIR,
              "index.html"
            );

          fs.readFile(
            indexPath,
            (indexError, data) => {

              if (indexError) {

                res.writeHead(
                  404,
                  {
                    "Content-Type":
                      "text/plain; charset=utf-8"
                  }
                );

                res.end(
                  "Page not found"
                );

                return;
              }

              res.writeHead(
                200,
                {
                  "Content-Type":
                    "text/html; charset=utf-8"
                }
              );

              res.end(data);
            }
          );

          return;
        }

        res.writeHead(
          404,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "File not found"
        );

        return;
      }

      if (!stats.isFile()) {

        res.writeHead(
          404,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "File not found"
        );

        return;
      }

      fs.readFile(
        resolvedPath,
        (readError, data) => {

          if (readError) {

            console.error(
              "Static file error:",
              readError
            );

            res.writeHead(
              500,
              {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            );

            res.end(
              "Internal server error"
            );

            return;
          }

          const extension =
            path.extname(
              resolvedPath
            ).toLowerCase();

          const contentType =
            MIME_TYPES[extension] ||
            "application/octet-stream";

          res.writeHead(
            200,
            {
              "Content-Type":
                contentType,

              "Cache-Control":
                extension === ".html"
                  ? "no-cache"
                  : "public, max-age=3600"
            }
          );

          res.end(data);
        }
      );
    }
  );
}

// ------------------------------------------------------------
// HTTP server
// ------------------------------------------------------------

const server =
  http.createServer(
    async (req, res) => {

      // ------------------------------------------------------
      // CORS preflight
      // ------------------------------------------------------

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(
          204,
          {
            "Access-Control-Allow-Origin":
              "*",

            "Access-Control-Allow-Methods":
              "GET, POST, OPTIONS",

            "Access-Control-Allow-Headers":
              "Content-Type",

            "Access-Control-Max-Age":
              "86400"
          }
        );

        res.end();

        return;
      }

      const url =
        req.url.split("?")[0];

      // ------------------------------------------------------
      // Health check
      // ------------------------------------------------------

      if (
        req.method === "GET" &&
        url === "/api/health"
      ) {

        sendJson(
          res,
          200,
          {
            success: true,

            status:
              "ok",

            hospital:
              HOSPITAL_NAME,

            doctor:
              DOCTOR_NAME,

            city:
              HOSPITAL_CITY,

            emailNotifications:
              emailIsConfigured(),

            timestamp:
              new Date().toISOString()
          }
        );

        return;
      }

      // ------------------------------------------------------
      // Appointment endpoint
      // ------------------------------------------------------

      if (
        req.method === "POST" &&
        url === "/api/appointments"
      ) {

        await handleAppointment(
          req,
          res
        );

        return;
      }

      // ------------------------------------------------------
      // Unknown API endpoint
      // ------------------------------------------------------

      if (
        url.startsWith("/api/")
      ) {

        sendJson(
          res,
          404,
          {
            success: false,
            message:
              "API endpoint not found."
          }
        );

        return;
      }

      // ------------------------------------------------------
      // Static website
      // ------------------------------------------------------

      if (
        req.method === "GET"
      ) {

        serveStaticFile(
          req,
          res
        );

        return;
      }

      // ------------------------------------------------------
      // Method not allowed
      // ------------------------------------------------------

      res.writeHead(
        405,
        {
          "Content-Type":
            "text/plain; charset=utf-8",

          "Allow":
            "GET, POST, OPTIONS"
        }
      );

      res.end(
        "Method Not Allowed"
      );
    }
  );

// ------------------------------------------------------------
// Error handling
// ------------------------------------------------------------

server.on(
  "error",
  error => {

    if (
      error.code === "EADDRINUSE"
    ) {

      console.error(
        `Port ${PORT} is already in use.`
      );

      process.exit(1);

    } else {

      console.error(
        "Server error:",
        error
      );
    }
  }
);

// ------------------------------------------------------------
// Graceful shutdown
// ------------------------------------------------------------

function shutdown(
  signal
) {

  console.log(
    `${signal} received. Shutting down server...`
  );

  server.close(
    () => {

      console.log(
        "Server closed."
      );

      process.exit(0);
    }
  );

  setTimeout(
    () => {
      console.error(
        "Forced shutdown."
      );

      process.exit(1);
    },
    5000
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

ensureDataDirectory();

server.listen(
  PORT,
  HOST,
  () => {

    console.log("");
    console.log(
      "=============================================="
    );

    console.log(
      " Dr Krishna Induvasi Hospital"
    );

    console.log(
      " Paediatric Surgery & Urology"
    );

    console.log(
      "=============================================="
    );

    console.log(
      `Server running on port ${PORT}`
    );

    console.log(
      `Local URL: http://localhost:${PORT}`
    );

    console.log(
      `Appointments: ${APPOINTMENTS_FILE}`
    );

    console.log(
      `Notification email: ${NOTIFICATION_EMAIL}`
    );

    console.log(
      `Email notifications: ${
        emailIsConfigured()
          ? "ENABLED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Hospital contact: ${HOSPITAL_PHONE}`
    );

    console.log(
      "=============================================="
    );

    console.log("");
  }
);
