// ============================================================================
// 🩺 DOCTOR CONTROLLER (Business Logic for Consultation Queue & Case Reviews)
// ============================================================================
const store = require('../models/dataStore');

exports.getDashboardView = (req, res) => {
  const doctor = req.session.user;
  const doctorAppointments = store.appointments.filter(a => a.doctor_id === doctor.id || a.doctor_name === doctor.name);

  res.render('doctor/dashboard', {
    title: 'Doctor Portal | DermaScan AI',
    user: doctor,
    kioskState: store.kioskState,
    appointments: doctorAppointments.length > 0 ? doctorAppointments : store.appointments,
    message: req.query.message || null
  });
};

exports.postUpdateAppointment = (req, res) => {
  const { appointment_id, status, doctor_notes } = req.body;

  const apt = store.appointments.find(a => a.id === appointment_id);
  if (apt) {
    apt.status = status;
    apt.doctor_notes = doctor_notes;
    return res.redirect('/doctor/dashboard?message=' + encodeURIComponent(`Updated appointment ${apt.id} to ${status}`));
  }

  res.redirect('/doctor/dashboard?error=' + encodeURIComponent('Appointment not found'));
};
