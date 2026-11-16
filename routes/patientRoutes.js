const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patientController');

// Middleware: Enforce Patient Role
function requirePatient(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login?error=' + encodeURIComponent('Please sign in as a patient.'));
  if (req.session.user.role !== 'patient') return res.redirect('/auth/login?error=' + encodeURIComponent('Access denied. Patient role required.'));
  next();
}

router.get('/scanner', requirePatient, patientController.getScannerView);
router.get('/kiosk', (req, res) => res.redirect('/patient/scanner'));
router.get('/appointments', requirePatient, patientController.getAppointmentsView);
router.post('/book', requirePatient, patientController.postBookAppointment);

module.exports = router;
