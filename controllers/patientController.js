// ============================================================================
// 👤 PATIENT CONTROLLER (Business Logic for Scanner, Care & Appointments)
// ============================================================================
const store = require('../models/dataStore');
const wsQueue = require('../services/websocketQueue');
const cloudinaryService = require('../services/cloudinaryService');
const fs = require('fs');
const path = require('path');

exports.getScannerView = (req, res) => {
  const patient = req.session.user;

  // Register in Central FIFO Queue (handles new joins and preserves position on page refresh)
  const queueInfo = wsQueue.registerPatientHttp(patient ? patient.id : null, patient ? patient.name : null);
  const isMyTurn = queueInfo ? queueInfo.is_my_turn : false;

  res.render('patient/scanner', {
    title: 'Skin Scanner | DermaScan AI',
    user: patient,
    kioskState: {
      ...store.kioskState,
      is_locked: !isMyTurn,
      is_my_session: isMyTurn,
      stream_url: isMyTurn ? '/api/scanner/video_feed' : null
    },
    queueInfo,
    doctors: store.doctors,
    remedies: store.PRE_CARE_REMEDIES,
    message: req.query.message || null,
    error: req.query.error || null
  });
};

exports.getKioskView = exports.getScannerView;

exports.getAppointmentsView = (req, res) => {
  const myAppointments = store.appointments.filter(a => a.patient_id === req.session.user.id);
  res.render('patient/appointments', {
    title: 'My Appointments | DermaScan AI',
    user: req.session.user,
    kioskState: store.kioskState,
    appointments: myAppointments,
    message: req.query.message || null
  });
};

exports.postBookAppointment = async (req, res) => {
  const { doctor_id, slot, disease, confidence, image_url, latitude, longitude } = req.body;

  const doctor = store.doctors.find(d => d.id === doctor_id);
  if (!doctor) {
    return res.redirect('/patient/kiosk?error=' + encodeURIComponent('Selected doctor not found.'));
  }

  const aptId = `APT-${Math.floor(500 + Math.random() * 500)}`;
  const caseId = `CASE-${Math.floor(900 + Math.random() * 100)}`;
  const patient = req.session.user;

  let savedImageUrl = image_url || 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80';

  // Upload to Cloudinary (or fallback to local disk)
  if (image_url && image_url.startsWith('data:image/')) {
    savedImageUrl = await cloudinaryService.uploadLesionImage(image_url, caseId);
  }

  const newAppointment = {
    id: aptId,
    patient_id: patient.id,
    patient_name: patient.name,
    patient_phone: patient.phone || '+91 98765 43210',
    doctor_id: doctor.id,
    doctor_name: doctor.name,
    disease: disease || 'Melanoma',
    confidence: parseFloat(confidence) || 85.0,
    severity: store.PRE_CARE_REMEDIES[disease]?.severity || 'Moderate Attention',
    slot: slot || 'Tomorrow 10:00 AM',
    image_url: savedImageUrl,
    latitude: parseFloat(latitude) || 16.494356,
    longitude: parseFloat(longitude) || 80.501303,
    status: 'Confirmed',
    doctor_notes: 'Initial automated screening completed via IoT kiosk.',
    created_at: new Date().toLocaleString()
  };

  store.appointments.unshift(newAppointment);

  // Also log case for admin map
  store.cases.unshift({
    id: caseId,
    patient_id: patient.id,
    patient_name: patient.name,
    disease: newAppointment.disease,
    confidence: newAppointment.confidence,
    severity: newAppointment.severity,
    latitude: newAppointment.latitude,
    longitude: newAppointment.longitude,
    gps_status: 'GPS Locked (5 sats)',
    image_url: savedImageUrl,
    kiosk_id: 'Kiosk_01',
    created_at: new Date().toLocaleString(),
    color: store.PRE_CARE_REMEDIES[disease]?.color || '#ef4444'
  });

  // Dequeue from WebSocket queue
  if (patient) {
    wsQueue.dequeuePatient(patient.id);
  }

  // Release kiosk session if this patient had locked it
  if (store.kioskState.current_patient_id === patient.id || store.kioskState.current_patient === patient.name) {
    store.kioskState.status = 'Available';
    store.kioskState.current_patient = null;
    store.kioskState.current_patient_id = null;
    store.kioskState.session_started_at = null;
  }

  res.redirect('/patient/appointments?message=' + encodeURIComponent(`🎉 Appointment booked with ${doctor.name} for ${slot}!`));
};
