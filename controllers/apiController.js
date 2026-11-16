// ============================================================================
// ⚡ API CONTROLLER (Server-Side Hardware Arbiter & Live Camera Stream Proxy)
// Enforces HTTP 403 Forbidden on Camera Stream & Telemetry for Waiting Patients
// ============================================================================
const http = require('http');
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

  // Rule 2: Must be the CURRENT ACTIVE PATIENT in the FIFO queue
  const active = wsQueue.getActivePatient();
  if (!active || active.patientId !== user.id) {
    return res.status(403).send('HTTP 403 Forbidden: You are not the active patient in the scanner queue.');
  }

  // Rule 3: Register stream with queue arbiter so it can be terminated immediately on turn handover
  const registered = wsQueue.registerActiveStream(user.id, res);
  if (!registered) {
    return res.status(403).send('HTTP 403 Forbidden: Hardware camera ownership conflict.');
  }

  // Authorized! Stream MJPEG from Raspberry Pi hardware
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache, no-store, must-revalidate, pre-check=0, post-check=0, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Connection': 'close'
  });

  const piReq = http.request({
    hostname: '10.189.102.108',
    port: 5000,
    path: '/video_feed',
    method: 'GET',
    timeout: 10000
  }, (piRes) => {
    piRes.pipe(res);

    piRes.on('error', () => {
      try { res.end(); } catch (e) {}
    });
  });

  piReq.on('error', () => {
    // Fallback attempt to rpi.local
    const fallbackReq = http.request({
      hostname: 'rpi.local',
      port: 5000,
      path: '/video_feed',
      method: 'GET',
      timeout: 5000
    }, (fbRes) => {
      fbRes.pipe(res);
    });

    fallbackReq.on('error', () => {
      if (!res.headersSent) {
        res.status(502).send('Camera stream currently unavailable from Raspberry Pi.');
      } else {
        try { res.end(); } catch (e) {}
      }
    });

    fallbackReq.end();
  });

  req.on('close', () => {
    piReq.destroy();
  });

  piReq.end();
};

// ----------------------------------------------------------------------------
// 2. Live Camera Snapshot Image (Protected by Queue Ownership)
// ----------------------------------------------------------------------------
exports.getSnapshot = async (req, res) => {
  const user = req.session ? req.session.user : null;
  const active = wsQueue.getActivePatient();

  // If patient is not the active owner, reject with 403 Forbidden
  if (!user || !active || active.patientId !== user.id) {
    return res.status(403).send('HTTP 403 Forbidden: You do not own the active camera session.');
  }

  const endpoints = [
    'http://10.189.102.108:5000/snapshot.jpg',
    'http://rpi.local:5000/snapshot.jpg'
  ];

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

  res.status(404).send('No camera snapshot available');
};

// ----------------------------------------------------------------------------
// 3. Live Raspberry Pi Telemetry & YOLO Stats (Protected)
// ----------------------------------------------------------------------------
exports.getLiveStats = async (req, res) => {
  const user = req.session ? req.session.user : null;
  const active = wsQueue.getActivePatient();
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

  // Active patient: fetch live stats from Raspberry Pi
  const endpoints = [
    'http://10.189.102.108:5000/api/stats',
    'http://rpi.local:5000/api/stats'
  ];

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

  res.json({
    connected: false,
    privacy_locked: false,
    is_my_turn: true,
    is_my_session: true,
    stream_url: '/api/scanner/video_feed',
    detections: [],
    counts: {},
    fps: 0,
    latency: 0
  });
};

// ----------------------------------------------------------------------------
// 4. Queue / Kiosk Status & Session Management
// ----------------------------------------------------------------------------
exports.getKioskStatus = (req, res) => {
  const user = req.session ? req.session.user : null;
  const active = wsQueue.getActivePatient();
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
