const socket = io();

const fireStateEl = document.getElementById('fireState');
const smokeStateEl = document.getElementById('smokeState');
const alarmStateEl = document.getElementById('alarmState');
const buzzerStateEl = document.getElementById('buzzerState');
const fireRawEl = document.getElementById('fireRawValue');
const smokeRawEl = document.getElementById('smokeRawValue');
const deviceStatusPill = document.getElementById('deviceStatusPill');
const blynkStatusPill = document.getElementById('blynkStatusPill');
const deviceStateText = document.getElementById('deviceStateText');
const blynkStateText = document.getElementById('blynkStateText');
const lastUpdateDisplay = document.getElementById('lastUpdateDisplay');
const lastDataUpdateText = document.getElementById('lastDataUpdateText');

const fireCard = document.getElementById('fireCard');
const smokeCard = document.getElementById('smokeCard');
const alarmCard = document.getElementById('alarmCard');
const buzzerCard = document.getElementById('buzzerCard');

const trendHistory = {
  fire: [],
  smoke: [],
  alarm: [],
  buzzer: []
};

const trendConfig = {
  fire: { color: '#ff6b6b', min: 0, max: 1 },
  smoke: { color: '#fbbf24', min: 0, max: 1 },
  alarm: { color: '#f87171', min: 0, max: 1 },
  buzzer: { color: '#60a5fa', min: 0, max: 1 }
};

function formatTime(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '--:--:--';
  return date.toLocaleTimeString([], { hour12: false });
}

function updateConnectionIndicators(status) {
  const deviceOnline = status.deviceOnline !== false;
  const blynkOnline = status.blynkConnected !== false;

  deviceStatusPill.classList.toggle('online', deviceOnline);
  deviceStatusPill.classList.toggle('offline', !deviceOnline);
  deviceStatusPill.innerHTML = `<span class="dot"></span><span>${deviceOnline ? 'DEVICE ONLINE' : 'DEVICE OFFLINE'}</span>`;

  blynkStatusPill.classList.toggle('online', blynkOnline);
  blynkStatusPill.classList.toggle('offline', !blynkOnline);
  blynkStatusPill.classList.toggle('warning', blynkOnline);
  blynkStatusPill.innerHTML = `<span class="dot"></span><span>${blynkOnline ? 'BLYNK CONNECTED' : 'BLYNK DISCONNECTED'}</span>`;

  deviceStateText.textContent = deviceOnline ? 'ONLINE' : 'OFFLINE';
  blynkStateText.textContent = blynkOnline ? 'CONNECTED' : 'DISCONNECTED';
}

function pushTrendSample(key, value) {
  trendHistory[key].push(value);
  if (trendHistory[key].length > 30) {
    trendHistory[key].shift();
  }
}

function renderTrendChart(svgId, data, color, minValue, maxValue) {
  const svg = document.getElementById(svgId);
  if (!svg) return;

  const width = 320;
  const height = 140;
  const pad = 12;

  if (!data.length) {
    svg.innerHTML = '';
    return;
  }

  const min = Math.min(...data, minValue);
  const max = Math.max(...data, maxValue);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = pad + (index / Math.max(data.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  const gridLines = Array.from({ length: 4 }, (_, i) => {
    const y = pad + (i / 3) * (height - pad * 2);
    return `<line x1="${pad}" y1="${y}" x2="${width - pad}" y2="${y}" stroke="rgba(148,163,184,0.15)" stroke-width="1" />`;
  }).join('');

  svg.innerHTML = `
    <defs>
      <linearGradient id="fill-${svgId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${gridLines}
    <polyline fill="none" stroke="${color}" stroke-width="2.4" points="${points}" stroke-linecap="round" stroke-linejoin="round"></polyline>
  `;
}

function updateDashboard(status) {
  const fire = Number(status.fire ?? 0);
  const smoke = Number(status.smoke ?? 0);
  const alarm = Number(status.alarm ?? 0);
  const buzzer = Number(status.buzzer ?? 0);
  const fireRaw = Number(status.fireRaw ?? 0);
  const smokeRaw = Number(status.smokeRaw ?? 1);

  pushTrendSample('fire', fire);
  pushTrendSample('smoke', smoke);
  pushTrendSample('alarm', alarm);
  pushTrendSample('buzzer', buzzer);

  renderTrendChart('fireTrendChart', trendHistory.fire, trendConfig.fire.color, trendConfig.fire.min, trendConfig.fire.max);
  renderTrendChart('smokeTrendChart', trendHistory.smoke, trendConfig.smoke.color, trendConfig.smoke.min, trendConfig.smoke.max);
  renderTrendChart('alarmTrendChart', trendHistory.alarm, trendConfig.alarm.color, trendConfig.alarm.min, trendConfig.alarm.max);
  renderTrendChart('buzzerTrendChart', trendHistory.buzzer, trendConfig.buzzer.color, trendConfig.buzzer.min, trendConfig.buzzer.max);

  document.getElementById('fireTrendValue').textContent = fire === 1 ? 'Fire' : 'Normal';
  document.getElementById('smokeTrendValue').textContent = smoke === 1 ? 'Smoke' : 'Normal';
  document.getElementById('alarmTrendValue').textContent = alarm === 1 ? 'Active' : 'Safe';
  document.getElementById('buzzerTrendValue').textContent = buzzer === 1 ? 'On' : 'Off';

  fireStateEl.textContent = fire === 1 ? 'FIRE DETECTED' : 'NO FIRE';
  smokeStateEl.textContent = smoke === 1 ? 'SMOKE DETECTED' : 'NO SMOKE';
  alarmStateEl.textContent = alarm === 1 ? 'ALARM ACTIVE' : 'SYSTEM SAFE';
  buzzerStateEl.textContent = buzzer === 1 ? 'ON' : 'OFF';

  fireRawEl.textContent = String(fireRaw);
  smokeRawEl.textContent = String(smokeRaw);

  fireCard.classList.toggle('active', fire === 1);
  smokeCard.classList.toggle('active', smoke === 1);
  alarmCard.classList.toggle('active', alarm === 1);
  buzzerCard.classList.toggle('active', buzzer === 1);

  fireCard.classList.toggle('safe', fire === 0);
  smokeCard.classList.toggle('safe', smoke === 0);
  alarmCard.classList.toggle('safe', alarm === 0);
  buzzerCard.classList.toggle('safe', buzzer === 0);

  if (fire === 1 && smoke === 1) {
    fireStateEl.textContent = '🔥 FIRE DETECTED';
    smokeStateEl.textContent = '💨 SMOKE DETECTED';
    alarmStateEl.textContent = '🚨 ALARM ACTIVE';
    buzzerStateEl.textContent = '🔔 ON';
    fireCard.classList.add('active');
    smokeCard.classList.add('active');
    alarmCard.classList.add('active');
    buzzerCard.classList.add('active');
  }

  const timestamp = status.timestamp || new Date().toISOString();
  const formatted = formatTime(timestamp);
  lastUpdateDisplay.textContent = formatted;
  lastDataUpdateText.textContent = formatted;

  updateConnectionIndicators(status);
}

socket.on('connect', () => {
  socket.emit('request-status');
});

socket.on('disconnect', () => {
  const disconnectedState = {
    fire: 0,
    smoke: 0,
    alarm: 0,
    buzzer: 0,
    fireRaw: 0,
    smokeRaw: 1,
    deviceOnline: true,
    blynkConnected: false,
    timestamp: new Date().toISOString()
  };

  updateDashboard(disconnectedState);
  blynkStatusPill.innerHTML = '<span class="dot"></span><span>LOCAL SERVER DISCONNECTED</span>';
  blynkStatusPill.classList.remove('warning');
  blynkStatusPill.classList.add('offline');
});

socket.on('status', (status) => {
  updateDashboard(status);
});

fetch('/api/status')
  .then((response) => response.json())
  .then((status) => updateDashboard(status))
  .catch(() => {
    const fallback = {
      fire: 0,
      smoke: 0,
      alarm: 0,
      buzzer: 0,
      fireRaw: 0,
      smokeRaw: 1,
      deviceOnline: true,
      blynkConnected: false,
      timestamp: new Date().toISOString()
    };
    updateDashboard(fallback);
  });
