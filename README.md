# 🔬 Dermascan-AI: Clinical Tele-Dermatology Platform

An autonomous, IoT-integrated tele-dermatology and skin screening platform powered by **Node.js, Express, EJS, and WebSockets**, interfaced with a Raspberry Pi 5 YOLO11n-seg lesion scanner.

---

## ✨ Features

- **🛡️ FIFO Hardware Camera Arbiter:** Strictly enforces single-patient active ownership over the physical Raspberry Pi camera. Waiting patients remain in a real-time FIFO queue with HTTP 403 server-side stream protection.
- **⚡ Native RFC 6455 WebSocket Engine:** Instant turn handover, automatic patient promotion, and real-time queue position notifications with zero external dependencies.
- **☁️ Cloudinary Cloud Storage:** High-resolution lesion snapshots uploaded permanently to Cloudinary with offline fallback for local presentations.
- **👨‍⚕️ Doctor Consultation Queue & Case Reviews:** Interactive clinical inspection modal with full-resolution lesion snapshot lightbox (`🔍 Open Fully`).
- **🗺️ Administrative Clinical Registry & Map:** Live geographic outbreak mapping and exportable case history.
- **🚀 Vercel Ready:** Pre-configured with `vercel.json` for one-click deployment.

---

## 🚀 Quick Start

### 1. Installation
```bash
npm install
```

### 2. Environment Variables (.env)
Create a `.env` file in the root directory (see `.env.example`):
```env
PORT=5000
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Run Locally
```bash
npm start
```
The platform will be live at `http://localhost:5000`.

---

## 📁 Architecture
- `server.js` - Express application entry point & WebSocket upgrade handler
- `controllers/` - MVC Controllers for Patient, Doctor, Admin, Auth, and Camera Proxy
- `models/` - Central clinical data store and IoT hardware state
- `routes/` - Express route definitions
- `services/` - Centralized WebSocket queue arbiter & Cloudinary upload service
- `views/` - Dynamic EJS frontend templates
- `public/` - CSS stylesheets and static assets
