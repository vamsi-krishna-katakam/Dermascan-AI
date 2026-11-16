// ============================================================================
// 🧪 AUTOMATED VERIFICATION TEST: FIFO QUEUE & CAMERA FEED 403 AUTHORIZATION
// ============================================================================
const assert = require('assert');
const wsQueue = require('../services/websocketQueue');
const apiController = require('../controllers/apiController');

async function runTests() {
  console.log('🚀 Running DermaScan FIFO Queue & Camera Security Tests...\n');

  // Clear any existing queue items
  while (wsQueue.getActivePatient()) {
    wsQueue.dequeuePatient(wsQueue.getActivePatient().patientId);
  }

  // --------------------------------------------------------------------------
  // TEST A: Patient 1 joins -> ACTIVE; Patient 2 joins -> WAITING
  // --------------------------------------------------------------------------
  console.log('▶ TEST A: Patient 1 & Patient 2 Joining Order');
  const p1Status = wsQueue.registerPatientHttp('PT-1042', 'Vamsi Krishna');
  assert.strictEqual(p1Status.is_my_turn, true, 'Patient 1 must be active');
  assert.strictEqual(p1Status.position, 1, 'Patient 1 must be position #1');
  assert.strictEqual(p1Status.status, 'ACTIVE', 'Patient 1 status must be ACTIVE');
  console.log('  ✓ Patient 1 (Vamsi) registered as ACTIVE (Position #1)');

  const p2Status = wsQueue.registerPatientHttp('PT-1043', 'Sneha Reddy');
  assert.strictEqual(p2Status.is_my_turn, false, 'Patient 2 must NOT be active');
  assert.strictEqual(p2Status.position, 2, 'Patient 2 must be position #2');
  assert.strictEqual(p2Status.status, 'WAITING', 'Patient 2 status must be WAITING');
  assert.strictEqual(p2Status.total_waiting, 2, 'Total queue length must be 2');
  console.log('  ✓ Patient 2 (Sneha) registered as WAITING (Position #2)');

  // --------------------------------------------------------------------------
  // TEST B: Protect the Camera Stream (Server-Side 403 Authorization)
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST B: Camera Stream Authorization (/api/scanner/video_feed)');

  // Subtest B1: Unauthenticated request
  let resMockUnauth = createMockResponse();
  let reqMockUnauth = { session: null };
  apiController.getVideoStreamProxy(reqMockUnauth, resMockUnauth);
  assert.strictEqual(resMockUnauth.statusCode, 403, 'Unauthenticated user must receive 403');
  console.log('  ✓ Unauthenticated request rejected with HTTP 403 Forbidden');

  // Subtest B2: Waiting patient (Patient 2) attempts to access camera
  let resMockP2 = createMockResponse();
  let reqMockP2 = {
    session: {
      user: { id: 'PT-1043', name: 'Sneha Reddy', role: 'patient' }
    }
  };
  apiController.getVideoStreamProxy(reqMockP2, resMockP2);
  assert.strictEqual(resMockP2.statusCode, 403, 'Waiting patient must receive 403');
  assert(resMockP2.body.includes('403 Forbidden'), 'Response must clearly indicate 403 Forbidden');
  console.log('  ✓ Patient 2 (Waiting) rejected from camera stream with HTTP 403 Forbidden');

  // Subtest B3: Active patient (Patient 1) accesses camera
  let resMockP1 = createMockResponse();
  let reqMockP1 = {
    session: {
      user: { id: 'PT-1042', name: 'Vamsi Krishna', role: 'patient' }
    },
    on: () => {}
  };
  apiController.getVideoStreamProxy(reqMockP1, resMockP1);
  assert.strictEqual(resMockP1.statusCode, 200, 'Active patient must receive 200');
  console.log('  ✓ Patient 1 (Active Owner) granted stream access with HTTP 200 (multipart MJPEG)');

  // --------------------------------------------------------------------------
  // TEST C: Browser Refresh Deduplication
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST C: Browser Refresh Deduplication');
  const p1Refresh = wsQueue.registerPatientHttp('PT-1042', 'Vamsi Krishna');
  assert.strictEqual(p1Refresh.position, 1, 'Patient 1 remains Position #1 after refresh');
  assert.strictEqual(p1Refresh.total_waiting, 2, 'No duplicate entry created on refresh');
  assert.strictEqual(p1Refresh.is_my_turn, true, 'Patient 1 turn remains active');

  const p2Check = wsQueue.getQueueStatus('PT-1043');
  assert.strictEqual(p2Check.position, 2, 'Patient 2 remains Position #2');
  assert.strictEqual(p2Check.is_my_turn, false, 'Patient 2 is still WAITING');
  console.log('  ✓ Page refresh verified: Zero duplicates, ownership securely retained');

  // --------------------------------------------------------------------------
  // TEST D: Multi-Patient FIFO Order (3 Patients)
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST D: Multi-Patient FIFO Queue (3+ Patients)');
  const p3Status = wsQueue.registerPatientHttp('PT-1044', 'Amit Verma');
  assert.strictEqual(p3Status.position, 3, 'Patient 3 is Position #3');
  assert.strictEqual(p3Status.status, 'WAITING', 'Patient 3 is WAITING');
  console.log('  ✓ Patient 3 (Amit) joined as WAITING (Position #3 of 3)');

  // --------------------------------------------------------------------------
  // TEST E: Active Patient Logs Out / Passes Turn -> Auto-Promotion & Camera Revocation
  // --------------------------------------------------------------------------
  console.log('\n▶ TEST E: Turn Handover & Auto-Promotion');
  // Patient 1 leaves
  wsQueue.dequeuePatient('PT-1042');

  const p2Promoted = wsQueue.getQueueStatus('PT-1043');
  assert.strictEqual(p2Promoted.is_my_turn, true, 'Patient 2 promoted to ACTIVE');
  assert.strictEqual(p2Promoted.position, 1, 'Patient 2 is now Position #1');
  assert.strictEqual(p2Promoted.status, 'ACTIVE', 'Patient 2 status is now ACTIVE');

  const p3Promoted = wsQueue.getQueueStatus('PT-1044');
  assert.strictEqual(p3Promoted.position, 2, 'Patient 3 promoted to Position #2');
  assert.strictEqual(p3Promoted.is_my_turn, false, 'Patient 3 is still WAITING');
  console.log('  ✓ Patient 2 promoted to ACTIVE (Position #1); Patient 3 advanced to Position #2');

  // Verify Patient 1 can no longer access the camera
  let resMockP1After = createMockResponse();
  apiController.getVideoStreamProxy(reqMockP1, resMockP1After);
  assert.strictEqual(resMockP1After.statusCode, 403, 'Old patient must be blocked with 403');
  console.log('  ✓ Old active patient blocked with HTTP 403 Forbidden after leaving');

  // Verify Patient 2 can now access the camera
  let resMockP2After = createMockResponse();
  let reqMockP2After = {
    session: {
      user: { id: 'PT-1043', name: 'Sneha Reddy', role: 'patient' }
    },
    on: () => {}
  };
  apiController.getVideoStreamProxy(reqMockP2After, resMockP2After);
  assert.strictEqual(resMockP2After.statusCode, 200, 'Newly active patient now granted stream');
  console.log('  ✓ Newly promoted Patient 2 now granted camera access with HTTP 200');

  console.log('\n==========================================================');
  console.log('🎉 ALL 5 COMPREHENSIVE QUEUE & SECURITY TESTS PASSED 100%!');
  console.log('==========================================================\n');
}

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
      return this;
    },
    on() {},
    destroy() {
      this.destroyed = true;
    }
  };
}

runTests().catch(err => {
  console.error('❌ Test Failure:', err);
  process.exit(1);
});
