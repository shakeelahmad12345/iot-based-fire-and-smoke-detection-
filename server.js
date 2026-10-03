const express = require('express');
const http = require('http');
const path = require('path');
const axios = require('axios');
const dotenv = require('dotenv');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const BLYNK_TEMPLATE_ID = process.env.BLYNK_TEMPLATE_ID;
const BLYNK_TEMPLATE_NAME = process.env.BLYNK_TEMPLATE_NAME;
const BLYNK_AUTH_TOKEN = process.env.BLYNK_AUTH_TOKEN;

const requiredEnvVars = ['BLYNK_TEMPLATE_ID', 'BLYNK_TEMPLATE_NAME', 'BLYNK_AUTH_TOKEN'];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key] || process.env[key].trim() === '');

if (missingEnvVars.length > 0) {
  console.error('========================================');
  console.error(' Missing required environment variables ');
  console.error('========================================');
  console.error(`Required: ${missingEnvVars.join(', ')}`);
  console.error('Add them to the .env file before starting the server.');
  console.error('The Blynk auth token is never printed or exposed to the browser.');
  process.exit(1);
}

const POLLING_INTERVAL_MS = 1000;
const BLYNK_API_BASE = 'https://blynk.cloud/external/api';
let latestState = {
  fire: 0,
  smoke: 0,
  alarm: 0,
  buzzer: 0,
  fireRaw: 0,
  smokeRaw: 1,
  deviceOnline: true,
  blynkConnected: true,
  timestamp: new Date().toISOString()
};

let pollingTimer = null;
let lastSuccessfulFetch = null;

function sanitizeValue(value) {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function normalizeBlynkValues(rawValue) {
  if (Array.isArray(rawValue)) return rawValue.slice(0, 6);

  if (rawValue && typeof rawValue === 'object') {
    const orderedKeys = ['v0', 'v1', 'v2', 'v3', 'v4', 'v5'];
    const values = orderedKeys.map((key) => rawValue[key] ?? rawValue[key.toUpperCase()] ?? rawValue[Number(key.slice(1))]);
    const validValues = values.filter((value) => value !== undefined && value !== null);
    if (validValues.length >= 6) return validValues.slice(0, 6);
  }

  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) {
      throw new Error('Empty Blynk API response');
    }

    try {
      const parsedJson = JSON.parse(trimmed);
      const nestedValues = normalizeBlynkValues(parsedJson);
      if (nestedValues.length >= 6) return nestedValues;
    } catch (error) {
      // Ignore JSON parsing failure and continue with string parsing below.
    }

    const values = trimmed
      .split(/[\r\n,\s]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (values.length >= 6) return values.slice(0, 6);

    const objectLike = trimmed.match(/v\d+\s*[:=]\s*[-]?\d+/gi) || [];
    if (objectLike.length >= 6) {
      return objectLike.slice(0, 6).map((entry) => entry.split(/[:=]/).pop());
    }
  }

  throw new Error('Invalid Blynk API response: expected 6 datastream values');
}

function buildState(payload) {
  const fire = sanitizeValue(payload.V0 ?? 0);
  const smoke = sanitizeValue(payload.V1 ?? 0);
  const alarm = sanitizeValue(payload.V2 ?? 0);
  const buzzer = sanitizeValue(payload.V3 ?? 0);
  const fireRaw = sanitizeValue(payload.V4 ?? 0);
  const smokeRaw = sanitizeValue(payload.V5 ?? 1);

  return {
    fire,
    smoke,
    alarm,
    buzzer,
    fireRaw,
    smokeRaw,
    deviceOnline: true,
    blynkConnected: true,
    timestamp: new Date().toISOString()
  };
}

function setDisconnectedState() {
  latestState = {
    ...latestState,
    deviceOnline: false,
    blynkConnected: false,
    timestamp: new Date().toISOString()
  };
  io.emit('status', latestState);
}

async function fetchBlynkState() {
  const primaryEndpoint = `${BLYNK_API_BASE}/get?token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}&v0&v1&v2&v3&v4&v5`;
  const fallbackEndpoint = `${BLYNK_API_BASE}/get/all?token=${encodeURIComponent(BLYNK_AUTH_TOKEN)}`;

  try {
    let response = await axios.get(primaryEndpoint, {
      timeout: 8000,
      validateStatus: (status) => status >= 200 && status < 500
    });

    if (response.status >= 400) {
      throw new Error(`Blynk API HTTP ${response.status}`);
    }

    let datastreams = normalizeBlynkValues(response.data);

    if (!datastreams || datastreams.length < 6) {
      response = await axios.get(fallbackEndpoint, {
        timeout: 8000,
        validateStatus: (status) => status >= 200 && status < 500
      });
      datastreams = normalizeBlynkValues(response.data);
    }

    if (!datastreams || datastreams.length < 6) {
      throw new Error('Invalid Blynk API response: expected 6 datastream values');
    }

    const payload = {
      V0: datastreams[0],
      V1: datastreams[1],
      V2: datastreams[2],
      V3: datastreams[3],
      V4: datastreams[4],
      V5: datastreams[5]
    };

    latestState = buildState(payload);
    latestState.deviceOnline = true;
    latestState.blynkConnected = true;
    lastSuccessfulFetch = Date.now();

    console.log('Blynk: Connected');
    io.emit('status', latestState);
    return latestState;
  } catch (error) {
    const timestamp = new Date().toISOString();
    latestState = {
      ...latestState,
      deviceOnline: true,
      blynkConnected: false,
      timestamp
    };
    io.emit('status', latestState);
    console.error(`[${timestamp}] Blynk polling error: ${error.message}`);
    return latestState;
  }
}

function startPolling() {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }

  pollingTimer = setInterval(() => {
    fetchBlynkState();
  }, POLLING_INTERVAL_MS);

  fetchBlynkState();
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', async (req, res) => {
  try {
    const current = { ...latestState };
    res.json(current);
  } catch (error) {
    res.status(500).json({ error: 'Unable to read status' });
  }
});

io.on('connection', (socket) => {
  socket.emit('status', latestState);
  socket.on('request-status', () => {
    socket.emit('status', latestState);
  });
});

server.listen(PORT, () => {
  console.log('========================================');
  console.log(' IoT FIRE DETECTION DASHBOARD');
  console.log('========================================');
  console.log(`Server running: http://localhost:${PORT}`);
  console.log('Blynk: Connecting...');
  console.log('Dashboard: Ready');
  startPolling();
});

process.on('SIGINT', () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
  }
  console.log('\nStopping dashboard server...');
  process.exit(0);
});
