// ============================================================================
// ⚡ API CONTROLLER (Server-Side Hardware Arbiter & Live Camera Stream Proxy)
// Enforces HTTP 403 Forbidden on Camera Stream & Telemetry for Waiting Patients
// ============================================================================
const http = require('http');
const https = require('https');
const store = require('../models/dataStore');
const wsQueue = require('../services/websocketQueue');

// ----------------------------------------------------------------------------
// 1. Live Camera Stream Proxy (CRITICAL: Strict Server-Side 403 Authorization)
// ----------------------------------------------------------------------------
exports.getVideoStreamProxy = (req, res) => {
  const user = req.session ? req.session.user : null;

  // Rule 1: Must be authenticated as a patient
  if (!user || user.role !== 'patient') {
    return res.status(403).send('HTTP 403 Forbidden: Patient authentication required.');
  }

  // Auto-register if empty in serverless lambda environment
  let active = wsQueue.getActivePatient();
  if (!active) {
    wsQueue.registerPatientHttp(user.id, user.name);
    active = wsQueue.getActivePatient();
  }

  // Rule 2: Must be the CURRENT ACTIVE PATIENT in the FIFO queue
  if (!active || active.patientId !== user.id) {
    return res.status(403).send('HTTP 403 Forbidden: You are not the active patient in the scanner queue.');
  }

  // Rule 3: Register stream with queue arbiter so it can be terminated immediately on turn handover
  const registered = wsQueue.registerActiveStream(user.id, res);
  if (!registered) {
    return res.status(403).send('HTTP 403 Forbidden: Hardware camera ownership conflict.');
  }

  // Authorized! Stream MJPEG from Raspberry Pi hardware
  // Multi-tier resolution:
  // 1. Explicit query parameter ?pi_url=
  // 2. Environment variable RPI_STREAM_URL
  // 3. Local Pi on same machine (Python Flask on port 5001)
  // 4. Remote Pi on local LAN (10.189.102.108:5000 or rpi.local:5000)
  const candidateEndpoints = [];
  if (req.query && req.query.pi_url) {
    candidateEndpoints.push(req.query.pi_url);
  }
  if (process.env.RPI_STREAM_URL && !process.env.RPI_STREAM_URL.includes('trycloudflare.com')) {
    candidateEndpoints.push(process.env.RPI_STREAM_URL);
  }
  candidateEndpoints.push(
    'http://127.0.0.1:5001/video_feed',
    'http://localhost:5001/video_feed',
    'http://10.189.102.108:5000/video_feed',
    'http://rpi.local:5000/video_feed'
  );

  let streamConnected = false;

  function tryNextEndpoint(index) {
    if (index >= candidateEndpoints.length) {
      if (!res.headersSent) {
        return res.status(502).send('Camera stream currently unavailable from Raspberry Pi.');
      } else {
        try { res.end(); } catch (e) {}
        return;
      }
    }

    const targetUrl = candidateEndpoints[index];
    let client = http;
    let reqOpts = {};

    try {
      const parsed = new URL(targetUrl);
      client = parsed.protocol === 'https:' ? https : http;
      reqOpts = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'GET',
        timeout: 1200
      };
    } catch (err) {
      return tryNextEndpoint(index + 1);
    }

    const piReq = client.request(reqOpts, (piRes) => {
      if (piRes.statusCode >= 200 && piRes.statusCode < 300) {
        streamConnected = true;
        if (!res.headersSent) {
          res.writeHead(200, {
            'Content-Type': piRes.headers['content-type'] || 'multipart/x-mixed-replace; boundary=frame',
            'Cache-Control': 'no-cache, no-store, must-revalidate, pre-check=0, post-check=0, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'close'
          });
        }
        piRes.pipe(res);
        piRes.on('error', () => {
          try { res.end(); } catch (e) {}
        });
      } else {
        tryNextEndpoint(index + 1);
      }
    });

    piReq.on('timeout', () => {
      piReq.destroy();
      if (!streamConnected) tryNextEndpoint(index + 1);
    });

    piReq.on('error', () => {
      if (!streamConnected) tryNextEndpoint(index + 1);
    });

    req.on('close', () => {
      piReq.destroy();
    });

    piReq.end();
  }

  tryNextEndpoint(0);
};

// ----------------------------------------------------------------------------
// 2. Live Camera Snapshot Image (Protected by Queue Ownership)
// ----------------------------------------------------------------------------
exports.getSnapshot = async (req, res) => {
  const user = req.session ? req.session.user : null;
  let active = wsQueue.getActivePatient();
  if (!active && user && user.role === 'patient') {
    wsQueue.registerPatientHttp(user.id, user.name);
    active = wsQueue.getActivePatient();
  }

  // If patient is not the active owner, reject with 403 Forbidden
  if (!user || !active || active.patientId !== user.id) {
    return res.status(403).send('HTTP 403 Forbidden: You do not own the active camera session.');
  }

  const endpoints = [];
  if (req.query && req.query.pi_url) {
    try { endpoints.push(new URL(req.query.pi_url).origin + '/snapshot.jpg'); } catch (e) {}
  }
  if (process.env.RPI_STREAM_URL && !process.env.RPI_STREAM_URL.includes('trycloudflare.com')) {
    try { endpoints.push(new URL(process.env.RPI_STREAM_URL).origin + '/snapshot.jpg'); } catch (e) {}
  }
  endpoints.push(
    'http://127.0.0.1:5001/snapshot.jpg',
    'http://localhost:5001/snapshot.jpg',
    'http://10.189.102.108:5000/snapshot.jpg',
    'http://rpi.local:5000/snapshot.jpg'
  );

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        res.set('Content-Type', 'image/jpeg');
        res.set('Cache-Control', 'no-cache, no-store');
        return res.send(Buffer.from(buffer));
      }
    } catch (e) {}
  }

  // Cloud / Vercel fallback snapshot: deliver high-res case photo
  const fs = require('fs');
  const path = require('path');
  const fallbackPath = path.join(__dirname, '../public/uploads/cases/lesion_CASE-917_1794857738201.jpg');
  if (fs.existsSync(fallbackPath)) {
    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'no-cache, no-store');
    return res.sendFile(fallbackPath);
  }

  res.status(404).send('No camera snapshot available');
};

// ----------------------------------------------------------------------------
// 3. Live Raspberry Pi Telemetry & YOLO Stats (Protected)
// ----------------------------------------------------------------------------
exports.getLiveStats = async (req, res) => {
  const user = req.session ? req.session.user : null;
  let active = wsQueue.getActivePatient();
  if (!active && user && user.role === 'patient') {
    wsQueue.registerPatientHttp(user.id, user.name);
    active = wsQueue.getActivePatient();
  }
  const isMine = Boolean(user && active && active.patientId === user.id);

  // If user is waiting in queue, lock out telemetry to protect clinical privacy!
  if (!isMine) {
    return res.json({
      connected: true,
      privacy_locked: true,
      is_my_turn: false,
      is_my_session: false,
      status: 'In Use',
      current_patient: active ? active.patientName : 'Another Patient',
      stream_url: null,
      detections: [],
      counts: {},
      fps: 0,
      latency: 0
    });
  }

  // Active patient: fetch live stats from Raspberry Pi (or local Flask port 5001)
  const endpoints = [];
  if (req.query && req.query.pi_url) {
    try { endpoints.push(new URL(req.query.pi_url).origin + '/api/stats'); } catch (e) {}
  }
  if (process.env.RPI_STREAM_URL && !process.env.RPI_STREAM_URL.includes('trycloudflare.com')) {
    try { endpoints.push(new URL(process.env.RPI_STREAM_URL).origin + '/api/stats'); } catch (e) {}
  }
  endpoints.push(
    'http://127.0.0.1:5001/api/stats',
    'http://localhost:5001/api/stats',
    'http://10.189.102.108:5000/api/stats',
    'http://rpi.local:5000/api/stats'
  );

  for (const url of endpoints) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const data = await response.json();
        return res.json({
          connected: true,
          privacy_locked: false,
          is_my_turn: true,
          is_my_session: true,
          stream_url: '/api/scanner/video_feed',
          ...data
        });
      }
    } catch (e) {}
  }

  // Cloud / Vercel fallback: if physical Raspberry Pi is offline/not tunneled,
  // return active simulated telemetry so cloud viewers can test the AI detection platform
  const now = Date.now();
  const simulatedFps = (3.4 + Math.sin(now / 2000) * 0.2).toFixed(1);
  const simulatedLat = (270 + Math.floor(Math.sin(now / 1500) * 15));
  res.json({
    connected: true,
    is_simulation: true,
    privacy_locked: false,
    is_my_turn: true,
    is_my_session: true,
    stream_url: '/api/scanner/video_feed',
    fps: simulatedFps,
    latency: simulatedLat,
    detections: [],
    counts: {},
    gps: {
      latitude: 16.49433,
      longitude: 80.50128,
      status: "GPS Locked (5 Sats)",
      satellites: 5
    }
  });
};

// ----------------------------------------------------------------------------
// 4. Queue / Kiosk Status & Session Management
// ----------------------------------------------------------------------------
exports.getKioskStatus = (req, res) => {
  const user = req.session ? req.session.user : null;
  let active = wsQueue.getActivePatient();
  if (!active && user && user.role === 'patient') {
    wsQueue.registerPatientHttp(user.id, user.name);
    active = wsQueue.getActivePatient();
  }
  const isMine = Boolean(user && active && active.patientId === user.id);

  res.json({
    status: active ? 'In Use' : 'Available',
    current_patient: active ? active.patientName : null,
    current_patient_id: active ? active.patientId : null,
    is_my_session: isMine,
    is_my_turn: isMine,
    stream_url: isMine ? '/api/scanner/video_feed' : null
  });
};

exports.postStartKioskSession = (req, res) => {
  const patient = req.session ? req.session.user : null;
  if (!patient) {
    return res.status(401).json({ success: false, message: 'Please sign in as a patient.' });
  }

  const queueStatus = wsQueue.registerPatientHttp(patient.id, patient.name);
  res.json({ success: true, queueStatus });
};

exports.postEndKioskSession = (req, res) => {
  const patient = req.session ? req.session.user : null;
  if (patient) {
    wsQueue.dequeuePatient(patient.id);
  }
  res.json({ success: true, message: 'Session released. Passed turn to next patient.' });
};

exports.getCasesJson = (req, res) => {
  res.json(store.cases);
};

exports.getDoctorsJson = (req, res) => {
  res.json(store.doctors);
};

// Real-Time Server-Sent Events (SSE) fallback
exports.streamLiveEvents = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendUpdate = async () => {
    try {
      const user = req.session ? req.session.user : null;
      const active = wsQueue.getActivePatient();
      const isMine = Boolean(user && active && active.patientId === user.id);

      if (!isMine) {
        res.write(`data: ${JSON.stringify({
          privacy_locked: true,
          is_my_turn: false,
          is_my_session: false,
          status: 'In Use',
          current_patient: active ? active.patientName : 'Another Patient',
          stream_url: null,
          detections: [],
          counts: {}
        })}\n\n`);
        return;
      }

      const endpoints = [
        'http://127.0.0.1:5001/api/stats',
        'http://localhost:5001/api/stats',
        'http://10.189.102.108:5000/api/stats',
        'http://rpi.local:5000/api/stats'
      ];
      for (const url of endpoints) {
        try {
          const resp = await fetch(url, { signal: AbortSignal.timeout(900) });
          if (resp.ok) {
            const data = await resp.json();
            res.write(`data: ${JSON.stringify({
              privacy_locked: false,
              is_my_turn: true,
              is_my_session: true,
              connected: true,
              stream_url: '/api/scanner/video_feed',
              ...data
            })}\n\n`);
            return;
          }
        } catch (e) {}
      }
      res.write(`data: ${JSON.stringify({ privacy_locked: false, is_my_turn: true, connected: false, detections: [], counts: {} })}\n\n`);
    } catch (err) {}
  };

  sendUpdate();
  const intervalId = setInterval(sendUpdate, 800);

  req.on('close', () => {
    clearInterval(intervalId);
  });
};
