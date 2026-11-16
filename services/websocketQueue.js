// ============================================================================
// 🔌 CENTRALIZED REAL-TIME WEBSOCKET PATIENT FIFO QUEUE & HARDWARE ARBITER
// RFC 6455 Standard - Native Implementation (Zero External Dependencies)
// ============================================================================
const crypto = require('crypto');
const http = require('http');
const store = require('../models/dataStore');

// Central FIFO Queue: [{ patientId, patientName, socket, status, joinedAt, disconnectTimer }]
let queue = [];

// Pointer to the HTTP response currently receiving the active MJPEG camera proxy stream
let activeStreamResponse = null;
let activeStreamPatientId = null;

// Background polling loop for Raspberry Pi YOLO telemetry
let telemetryInterval = null;

// Synchronize with models/dataStore.kioskState
function syncKioskState() {
  if (queue.length > 0) {
    store.kioskState.status = 'In Use';
    store.kioskState.current_patient = queue[0].patientName;
    store.kioskState.current_patient_id = queue[0].patientId;
    store.kioskState.session_started_at = store.kioskState.session_started_at || new Date().toISOString();
    store.kioskState.stream_url = '/api/scanner/video_feed';
  } else {
    store.kioskState.status = 'Available';
    store.kioskState.current_patient = null;
    store.kioskState.current_patient_id = null;
    store.kioskState.session_started_at = null;
    store.kioskState.stream_url = '/api/scanner/video_feed';
  }
}

// ----------------------------------------------------------------------------
// 1. WebSocket RFC 6455 Low-Level Utilities
// ----------------------------------------------------------------------------
function sendFrame(socket, text) {
  if (!socket || socket.destroyed || !socket.writable) return;
  try {
    const payload = Buffer.from(text, 'utf8');
    const length = payload.length;
    let header;
    if (length < 126) {
      header = Buffer.from([0x81, length]);
    } else if (length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 126;
      header.writeUInt16BE(length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(length), 2);
    }
    socket.write(Buffer.concat([header, payload]));
  } catch (err) {}
}

// ----------------------------------------------------------------------------
// 2. Broadcast Queue Updates
// ----------------------------------------------------------------------------
function broadcastQueue() {
  syncKioskState();

  queue.forEach((item, index) => {
    const isTurn = index === 0;
    item.status = isTurn ? 'ACTIVE' : 'WAITING';

    const msg = JSON.stringify({
      type: 'QUEUE_UPDATE',
      event: isTurn ? 'queue:active' : 'queue:waiting',
      is_my_turn: isTurn,
      position: index + 1,
      total_waiting: queue.length,
      active_patient: queue[0] ? queue[0].patientName : null,
      stream_url: isTurn ? '/api/scanner/video_feed' : null,
      queue: queue.map((q, i) => ({ position: i + 1, name: q.patientName }))
    });
    sendFrame(item.socket, msg);
  });
}

// ----------------------------------------------------------------------------
// 3. FIFO Queue State Management
// ----------------------------------------------------------------------------

/**
 * Registers patient when they load /patient/scanner via HTTP GET.
 * This guarantees the server knows who is ACTIVE before the page even finishes rendering!
 */
function registerPatientHttp(patientId, patientName) {
  if (!patientId) return null;

  const existing = queue.find(q => q.patientId === patientId);
  if (existing) {
    // If there was a pending disconnect timer from a page refresh, cancel it immediately!
    if (existing.disconnectTimer) {
      clearTimeout(existing.disconnectTimer);
      existing.disconnectTimer = null;
    }
    if (patientName) existing.patientName = patientName;
    return getQueueStatus(patientId);
  }

  // New patient joining queue
  const isFirst = queue.length === 0;
  const newEntry = {
    patientId,
    patientName: patientName || 'Patient',
    socket: null,
    status: isFirst ? 'ACTIVE' : 'WAITING',
    joinedAt: Date.now(),
    disconnectTimer: null
  };
  queue.push(newEntry);
  broadcastQueue();
  startTelemetryLoop();
  return getQueueStatus(patientId);
}

/**
 * Attaches a WebSocket connection to an existing patient in the queue
 */
function attachSocket(patientId, patientName, socket) {
  if (!patientId) return;

  let entry = queue.find(q => q.patientId === patientId);
  if (entry) {
    if (entry.disconnectTimer) {
      clearTimeout(entry.disconnectTimer);
      entry.disconnectTimer = null;
    }
    if (entry.socket && entry.socket !== socket && !entry.socket.destroyed) {
      try { entry.socket.destroy(); } catch(e) {}
    }
    entry.socket = socket;
    if (patientName) entry.patientName = patientName;
  } else {
    const isFirst = queue.length === 0;
    entry = {
      patientId,
      patientName: patientName || 'Patient',
      socket,
      status: isFirst ? 'ACTIVE' : 'WAITING',
      joinedAt: Date.now(),
      disconnectTimer: null
    };
    queue.push(entry);
  }

  broadcastQueue();
  startTelemetryLoop();
}

/**
 * Removes a patient from the queue (on logout, pass turn, appointment booked, or tab closed)
 */
function dequeuePatient(patientId) {
  if (!patientId) return;

  const idx = queue.findIndex(q => q.patientId === patientId);
  if (idx < 0) return;

  const [removed] = queue.splice(idx, 1);
  if (removed && removed.disconnectTimer) {
    clearTimeout(removed.disconnectTimer);
  }

  // If the active patient was removed, sever their camera stream immediately!
  if (idx === 0) {
    terminateActiveStream();
  }

  // Promote the new head of queue to ACTIVE
  if (queue.length > 0) {
    queue[0].status = 'ACTIVE';
  }

  broadcastQueue();
}

/**
 * Handles socket disconnection with a grace period so page refreshes do NOT drop queue position
 */
function handleSocketDisconnect(socket) {
  const entry = queue.find(q => q.socket === socket);
  if (!entry) return;

  entry.socket = null;

  // Clear any existing timer
  if (entry.disconnectTimer) {
    clearTimeout(entry.disconnectTimer);
  }

  // 4-second grace period: if user refreshes page, new socket reconnects and cancels this timer
  entry.disconnectTimer = setTimeout(() => {
    dequeuePatient(entry.patientId);
  }, 4000);
}

/**
 * Query active patient in queue
 */
function getActivePatient() {
  if (queue.length > 0) {
    return {
      patientId: queue[0].patientId,
      patientName: queue[0].patientName,
      status: 'ACTIVE'
    };
  }
  return null;
}

/**
 * Query queue status for a given patient ID
 */
function getQueueStatus(patientId) {
  const active = queue.length > 0 ? queue[0] : null;
  const isTurn = Boolean(active && active.patientId === patientId);
  const myIndex = queue.findIndex(q => q.patientId === patientId);
  const position = myIndex >= 0 ? myIndex + 1 : (queue.length + 1);

  return {
    is_my_turn: isTurn,
    position: position,
    total_waiting: queue.length,
    active_patient: active ? active.patientName : null,
    status: isTurn ? 'ACTIVE' : 'WAITING',
    queue: queue.map((q, i) => ({ position: i + 1, name: q.patientName }))
  };
}

// ----------------------------------------------------------------------------
// 4. Camera Stream Response Authorization & Termination
// ----------------------------------------------------------------------------
function registerActiveStream(patientId, res) {
  const active = getActivePatient();
  if (!active || active.patientId !== patientId) {
    return false;
  }
  // Terminate any previous stream response
  if (activeStreamResponse && activeStreamResponse !== res) {
    try { activeStreamResponse.destroy(); } catch(e) {}
  }
  activeStreamResponse = res;
  activeStreamPatientId = patientId;

  res.on('close', () => {
    if (activeStreamResponse === res) {
      activeStreamResponse = null;
      activeStreamPatientId = null;
    }
  });
  return true;
}

function terminateActiveStream() {
  if (activeStreamResponse) {
    try {
      activeStreamResponse.destroy();
    } catch(e) {}
    activeStreamResponse = null;
    activeStreamPatientId = null;
  }
}

// ----------------------------------------------------------------------------
// 5. Telemetry Push Loop (Strictly to Active Patient Only)
// ----------------------------------------------------------------------------
async function fetchPiStats() {
  const endpoints = [
    'http://10.189.102.108:5000/api/stats',
    'http://rpi.local:5000/api/stats'
  ];
  for (const url of endpoints) {
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (resp.ok) {
        return await resp.json();
      }
    } catch(e) {}
  }
  return { connected: false, detections: [], counts: {}, fps: 0, latency: 0 };
}

function startTelemetryLoop() {
  if (telemetryInterval) return;

  telemetryInterval = setInterval(async () => {
    if (queue.length === 0) {
      clearInterval(telemetryInterval);
      telemetryInterval = null;
      return;
    }

    const activeItem = queue[0];
    try {
      const stats = await fetchPiStats();

      // Only the ACTIVE patient receives live camera stream info and detections
      if (activeItem && activeItem.socket && !activeItem.socket.destroyed) {
        sendFrame(activeItem.socket, JSON.stringify({
          type: 'TELEMETRY',
          event: 'queue:active',
          is_my_turn: true,
          position: 1,
          total_waiting: queue.length,
          active_patient: activeItem.patientName,
          stream_url: '/api/scanner/video_feed',
          ...stats
        }));
      }

      // Waiting patients (Position 2+) receive ONLY queue status (NEVER camera frames or AI detections!)
      for (let i = 1; i < queue.length; i++) {
        const waitingItem = queue[i];
        if (waitingItem && waitingItem.socket && !waitingItem.socket.destroyed) {
          sendFrame(waitingItem.socket, JSON.stringify({
            type: 'QUEUE_STATUS',
            event: 'queue:waiting',
            is_my_turn: false,
            position: i + 1,
            total_waiting: queue.length,
            active_patient: activeItem ? activeItem.patientName : 'Active Patient',
            stream_url: null,
            detections: [],
            counts: {}
          }));
        }
      }
    } catch (e) {}
  }, 800);
}

// ----------------------------------------------------------------------------
// 6. WebSocket Server Initialization (RFC 6455)
// ----------------------------------------------------------------------------
function initWebSocket(server) {
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/ws')) {
      socket.destroy();
      return;
    }

    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto
      .createHash('sha1')
      .update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64');

    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    let attachedPatientId = null;

    socket.on('data', (buf) => {
      try {
        const opcode = buf[0] & 0x0f;
        if (opcode === 0x08) { // Close frame
          socket.destroy();
          return;
        }
        if (opcode === 0x09) { // Ping
          socket.write(Buffer.from([0x8a, 0x00])); // Pong
          return;
        }

        const isMasked = (buf[1] & 0x80) !== 0;
        let len = buf[1] & 0x7f;
        let offset = 2;
        if (len === 126) {
          len = buf.readUInt16BE(2);
          offset = 4;
        } else if (len === 127) {
          len = Number(buf.readBigUInt64BE(2));
          offset = 10;
        }

        let payload;
        if (isMasked) {
          const mask = buf.slice(offset, offset + 4);
          offset += 4;
          payload = Buffer.alloc(len);
          for (let i = 0; i < len; i++) {
            payload[i] = buf[offset + i] ^ mask[i % 4];
          }
        } else {
          payload = buf.slice(offset, offset + len);
        }

        const data = JSON.parse(payload.toString('utf8'));

        if (data.action === 'join' || data.event === 'queue:join') {
          attachedPatientId = data.patientId;
          attachSocket(data.patientId, data.patientName, socket);
        } else if (data.action === 'leave' || data.action === 'next' || data.event === 'queue:next') {
          dequeuePatient(data.patientId || attachedPatientId);
        }
      } catch (e) {}
    });

    socket.on('close', () => {
      handleSocketDisconnect(socket);
    });

    socket.on('error', () => {
      socket.destroy();
    });
  });
}

module.exports = {
  initWebSocket,
  registerPatientHttp,
  attachSocket,
  dequeuePatient,
  getQueueStatus,
  getActivePatient,
  registerActiveStream,
  terminateActiveStream,
  broadcastQueue
};
