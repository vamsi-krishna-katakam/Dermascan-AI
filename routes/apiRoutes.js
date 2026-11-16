// ============================================================================
// ⚡ API ROUTES (Hardware Kiosk, Video Stream Proxy & AJAX Endpoints)
// ============================================================================
const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');

// 1. Live Camera Stream Proxy (Protected: 403 Forbidden for Waiting Patients)
router.get('/scanner/video_feed', apiController.getVideoStreamProxy);
router.get('/video_feed', apiController.getVideoStreamProxy);

// 2. Scanner Session & Queue Endpoints
router.get('/scanner/status', apiController.getKioskStatus);
router.post('/scanner/start-session', apiController.postStartKioskSession);
router.post('/scanner/end-session', apiController.postEndKioskSession);

// Aliases for compatibility
router.get('/kiosk/status', apiController.getKioskStatus);
router.post('/kiosk/start-session', apiController.postStartKioskSession);
router.post('/kiosk/end-session', apiController.postEndKioskSession);

// 3. Live Raspberry Pi Detections & Telemetry (Protected)
router.get('/scanner/live-stats', apiController.getLiveStats);
router.get('/live-stats', apiController.getLiveStats);

// 4. Real-Time Push Events (SSE fallback)
router.get('/scanner/events', apiController.streamLiveEvents);
router.get('/events', apiController.streamLiveEvents);

// 5. Live Camera Snapshot Image (Protected)
router.get('/scanner/snapshot', apiController.getSnapshot);
router.get('/snapshot', apiController.getSnapshot);

// 6. Clinical Cases & Doctors JSON
router.get('/cases', apiController.getCasesJson);
router.get('/doctors', apiController.getDoctorsJson);

module.exports = router;
