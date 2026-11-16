// ============================================================================
// 🛡️ ADMIN CONTROLLER (Business Logic for Outbreak Map, Doctors & Registry)
// ============================================================================
const store = require('../models/dataStore');

exports.getMapView = (req, res) => {
  res.render('admin/map', {
    title: 'Epidemiological Outbreak Map | DermaScan AI',
    user: req.session.user,
    kioskState: store.kioskState,
    cases: store.cases,
    message: req.query.message || null
  });
};

exports.getDoctorsView = (req, res) => {
  res.render('admin/doctors', {
    title: 'Doctor Directory & Management | DermaScan AI',
    user: req.session.user,
    kioskState: store.kioskState,
    doctors: store.doctors,
    message: req.query.message || null
  });
};

exports.postCreateDoctor = (req, res) => {
  const { name, title, specialties, hospital, experience_years, email, password } = req.body;

  const newDoc = {
    id: `DOC-${Math.floor(100 + Math.random() * 900)}`,
    name: name.trim(),
    title: title || 'Consultant Dermatologist',
    specialties: Array.isArray(specialties) ? specialties : (specialties ? specialties.split(',').map(s => s.trim()) : ['General Dermatology']),
    hospital: hospital || 'District General Hospital',
    experience_years: parseInt(experience_years) || 8,
    rating: 4.8,
    available_slots: ['Tomorrow 10:00 AM', 'Tomorrow 2:00 PM', 'Friday 11:30 AM'],
    email: email.trim().toLowerCase(),
    password: password || '123'
  };

  store.doctors.push(newDoc);
  res.redirect('/admin/doctors?message=' + encodeURIComponent(`Doctor ${newDoc.name} registered successfully.`));
};

exports.getRegistryView = (req, res) => {
  res.render('admin/registry', {
    title: 'Clinical Case Registry | DermaScan AI',
    user: req.session.user,
    kioskState: store.kioskState,
    cases: store.cases
  });
};

exports.getExportCsv = (req, res) => {
  let csv = "Case ID,Patient Name,Disease,Confidence,Latitude,Longitude,Severity,Date\n";
  store.cases.forEach(c => {
    csv += `"${c.id}","${c.patient_name}","${c.disease}",${c.confidence}%,${c.latitude},${c.longitude},"${c.severity}","${c.created_at}"\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="dermascan_clinical_registry_${Date.now()}.csv"`);
  res.send(csv);
};
