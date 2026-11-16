// ============================================================================
// 🏥 DERMASCAN HEALTHCARE PLATFORM - MAIN EXPRESS SERVER (MVC ARCHITECTURE)
// ============================================================================

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

// 1. Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;

// 2. Configure View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 3. Middlewares
app.use(cors());
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 4. Session Configuration
app.use(session({
  secret: 'dermascan_telehealth_clinical_session_secret_2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 } // 24 hours
}));

const store = require('./models/dataStore');

// 5. Global Locals Middleware (Make user and kiosk state available in all views)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.kioskState = store.kioskState;
  next();
});

// 6. Import MVC Routes
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const apiRoutes = require('./routes/apiRoutes');

// 7. Mount Routers
const apiController = require('./controllers/apiController');
app.get('/video_feed', apiController.getVideoStreamProxy);
app.get('/snapshot.jpg', apiController.getSnapshot);

app.use('/auth', authRoutes);
app.use('/patient', patientRoutes);
app.use('/doctor', doctorRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);

// 8. Root Redirect Handler
app.get('/', (req, res) => {
  if (req.session.user) {
    if (req.session.user.role === 'patient') return res.redirect('/patient/scanner');
    if (req.session.user.role === 'doctor') return res.redirect('/doctor/dashboard');
    if (req.session.user.role === 'admin') return res.redirect('/admin/map');
  }
  res.redirect('/auth/login');
});

// 9. 404 Not Found Handler
app.use((req, res) => {
  res.status(404).render('auth/login', {
    title: 'Page Not Found | DermaScan AI',
    error: 'The requested page was not found.',
    message: null,
    user: req.session.user || null
  });
});

// 10. Start Server with Native WebSocket Queue
const wsQueue = require('./services/websocketQueue');

const server = app.listen(PORT, () => {
  console.log(`\n==========================================================`);
  console.log(`🏥 Dermascan Healthcare Platform (Node.js + Express + EJS)`);
  console.log(`🚀 Live on: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket Queue Engine: ws://localhost:${PORT}/ws/scanner`);
  console.log(`📁 Architectural Pattern: Full MVC (Models, Views, Controllers)`);
  console.log(`==========================================================\n`);
});

wsQueue.initWebSocket(server);

module.exports = app;
