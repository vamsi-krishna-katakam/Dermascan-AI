const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');

// Middleware: Enforce Doctor Role
function requireDoctor(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login?error=' + encodeURIComponent('Please sign in as a doctor.'));
  if (req.session.user.role !== 'doctor') return res.redirect('/auth/login?error=' + encodeURIComponent('Access denied. Doctor role required.'));
  next();
}

router.get('/dashboard', requireDoctor, doctorController.getDashboardView);
router.post('/update-appointment', requireDoctor, doctorController.postUpdateAppointment);

module.exports = router;
