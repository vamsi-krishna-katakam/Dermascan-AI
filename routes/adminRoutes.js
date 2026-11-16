const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');

// Middleware: Enforce Administrator Role
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/auth/login?error=' + encodeURIComponent('Please sign in as an administrator.'));
  if (req.session.user.role !== 'admin') return res.redirect('/auth/login?error=' + encodeURIComponent('Access denied. Administrator role required.'));
  next();
}

router.get('/map', requireAdmin, adminController.getMapView);
router.get('/doctors', requireAdmin, adminController.getDoctorsView);
router.post('/doctors', requireAdmin, adminController.postCreateDoctor);
router.get('/registry', requireAdmin, adminController.getRegistryView);
router.get('/export-csv', requireAdmin, adminController.getExportCsv);

module.exports = router;
