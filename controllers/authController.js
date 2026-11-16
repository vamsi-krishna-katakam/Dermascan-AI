// ============================================================================
// 🔐 AUTH CONTROLLER (Business Logic for Authentication & Demo Logins)
// ============================================================================
const store = require('../models/dataStore');
const wsQueue = require('../services/websocketQueue');

exports.getLoginPage = (req, res) => {
  res.render('auth/login', {
    title: 'Sign In & Register | DermaScan AI',
    error: req.query.error || null,
    message: req.query.message || null,
    user: req.session.user || null
  });
};

exports.postLogin = (req, res) => {
  const { email, password } = req.body;

  // 1. Check Chief Administrator
  if (email === 'admin@dermascan.com' && password === 'admin123') {
    req.session.user = {
      id: 'ADMIN-01',
      name: 'Chief Administrator',
      role: 'admin',
      email: 'admin@dermascan.com'
    };
    return res.redirect('/admin/map');
  }

  // 2. Check Doctors
  const doctor = store.doctors.find(d => d.email.toLowerCase() === (email || '').toLowerCase() && d.password === password);
  if (doctor) {
    req.session.user = {
      id: doctor.id,
      name: doctor.name,
      role: 'doctor',
      title: doctor.title,
      hospital: doctor.hospital,
      email: doctor.email
    };
    return res.redirect('/doctor/dashboard');
  }

  // 3. Check Patients
  const patient = store.patients.find(p => p.email.toLowerCase() === (email || '').toLowerCase() && p.password === password);
  if (patient) {
    req.session.user = {
      id: patient.id,
      name: patient.name,
      role: 'patient',
      age: patient.age,
      phone: patient.phone,
      email: patient.email
    };
    return res.redirect('/patient/scanner');
  }

  // Invalid Credentials
  return res.redirect('/auth/login?error=' + encodeURIComponent('Invalid email or password.'));
};

exports.postRegister = (req, res) => {
  const { name, age, gender, phone, email, password } = req.body;

  if (!email || !password || !name) {
    return res.redirect('/auth/login?error=' + encodeURIComponent('Please fill out all required fields.'));
  }

  const existing = store.patients.find(p => p.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.redirect('/auth/login?error=' + encodeURIComponent('Email is already registered. Please sign in.'));
  }

  const newPatient = {
    id: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
    name: name.trim(),
    age: parseInt(age) || 25,
    gender: gender || 'Male',
    phone: phone || '+91 98765 00000',
    email: email.trim().toLowerCase(),
    password: password,
    created_at: new Date().toISOString()
  };

  store.patients.push(newPatient);

  req.session.user = {
    id: newPatient.id,
    name: newPatient.name,
    role: 'patient',
    age: newPatient.age,
    phone: newPatient.phone,
    email: newPatient.email
  };

  return res.redirect('/patient/scanner?message=' + encodeURIComponent(`Welcome ${newPatient.name}! Account registered successfully.`));
};

exports.getDemoLogin = (req, res) => {
  const role = req.params.role;
  if (role === 'patient') {
    req.session.user = {
      id: 'PT-1042',
      name: 'Vamsi Krishna',
      role: 'patient',
      phone: '+91 98765 43210',
      email: 'vamsi@patient.com'
    };
    return res.redirect('/patient/scanner');
  } else if (role === 'doctor') {
    req.session.user = {
      id: 'DOC-101',
      name: 'Dr. A. Sharma',
      role: 'doctor',
      title: 'Senior Consultant Dermatologist',
      hospital: 'Apex Skin & Oncology Clinic',
      email: 'sharma@dermascan.com'
    };
    return res.redirect('/doctor/dashboard');
  } else if (role === 'admin') {
    req.session.user = {
      id: 'ADMIN-01',
      name: 'Chief Administrator',
      role: 'admin',
      email: 'admin@dermascan.com'
    };
    return res.redirect('/admin/map');
  }
  res.redirect('/auth/login');
};

exports.getLogout = (req, res) => {
  const user = req.session ? req.session.user : null;
  if (user) {
    wsQueue.dequeuePatient(user.id);
  }
  if (user && store.kioskState.current_patient_id === user.id) {
    store.kioskState.status = 'Available';
    store.kioskState.current_patient = null;
    store.kioskState.current_patient_id = null;
    store.kioskState.session_started_at = null;
  }
  req.session.destroy(() => {
    res.redirect('/auth/login?message=' + encodeURIComponent('Logged out successfully.'));
  });
};
