# IoT Based Fire Detection Alarm System

## Overview
This project adds a local monitoring dashboard to an existing ESP32-based fire detection alarm system that already sends sensor data to Blynk Cloud. The dashboard runs locally in the browser at http://localhost:3000 and receives live updates through a Node.js backend and Socket.IO.

## Architecture

ESP32
 ↓
Wi‑Fi
 ↓
Blynk Cloud
 ↓
Node.js
 ↓
Socket.IO
 ↓
Local Dashboard

The ESP32 firmware remains unchanged. It continues to send fire, smoke, alarm, and buzzer values to Blynk Cloud. A local Node.js service polls the Blynk API at regular intervals and streams the updated values to the browser dashboard.

## Hardware
- ESP32 development board
- Fire detection sensor
- Smoke detection sensor
- Buzzer alarm
- LED indicators
- Wi-Fi connectivity
- Existing Blynk cloud configuration

## Blynk Datastream Mapping
| Datastream | Meaning |
|---|---|
| V0 | Fire Status |
| V1 | Smoke Status |
| V2 | Alarm Status |
| V3 | Buzzer Status |
| V4 | Fire Sensor Raw |
| V5 | Smoke Sensor Raw |

## Sensor Logic
- Fire sensor: 0 = No Fire, 1 = Fire Detected
- Smoke sensor: 1 = No Smoke, 0 = Smoke Detected
- V0: 0 = Normal, 1 = Fire Detected
- V1: 0 = No Smoke, 1 = Smoke Detected
- V2: 0 = Alarm Normal, 1 = Alarm Active
- V3: 0 = Buzzer Off, 1 = Buzzer On
- V4: 0 = No Fire, 1 = Fire
- V5: 1 = No Smoke, 0 = Smoke Detected

## Software Architecture
- Express server serves the static frontend assets from the public folder
- Axios retrieves values from the official Blynk Cloud API
- Socket.IO pushes the latest state to connected browser clients
- Browser JavaScript updates the dashboard instantly without manual refresh

## Installation
1. Install Node.js LTS.
2. Open the project folder.
3. Copy `.env.example` to `.env`.
4. Add the actual Blynk auth token to `.env`.
5. Run the following commands:

```bash
npm install
npm start
```

## Environment Variables
Required variables:

```bash
BLYNK_TEMPLATE_ID=TMPL6e4Omyv1
BLYNK_TEMPLATE_NAME=IoT Based Fire Detection Alarm System
BLYNK_AUTH_TOKEN=YOUR_TOKEN_HERE
PORT=3000
```

The Auth Token is stored only in `.env` and is never sent to the browser.

## How to Run
```bash
npm start
```

Then visit:

```text
http://localhost:3000
```

For development with auto-reload:

```bash
npm run dev
```

## Dashboard States
- Normal: NO FIRE, NO SMOKE, SYSTEM SAFE, BUZZER OFF
- Fire Only: FIRE DETECTED, ALARM ACTIVE, BUZZER ON
- Smoke Only: SMOKE DETECTED, ALARM ACTIVE, BUZZER ON
- Fire + Smoke: FIRE DETECTED + SMOKE DETECTED, DANGER state displayed

## Troubleshooting
- If Blynk is disconnected, the dashboard shows BLYNK DISCONNECTED.
- If local Socket.IO disconnects, the browser shows LOCAL SERVER DISCONNECTED.
- Ensure the Blynk auth token is valid and the ESP32 device is online.
- Check the terminal for missing environment variables.

## Security Notes
- Do not place the Blynk token in browser code or HTML files.
- Do not expose the token through API responses.
- Keep the token only in `.env` on the server.
- `.env` is ignored by Git.
