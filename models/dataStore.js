// ============================================================================
// 🏥 DERMASCAN HEALTHCARE PLATFORM - CENTRAL CLINICAL DATA STORE (MODEL)
// ============================================================================

// 1. Initial Doctors (Specialized in multiple skin conditions)
let doctors = [
  {
    id: "DOC-101",
    name: "Dr. A. Sharma",
    title: "Senior Consultant Dermatologist",
    specialties: ["Melanoma", "Vitiligo", "Eczema"],
    hospital: "Apex Skin & Oncology Clinic",
    experience_years: 14,
    rating: 4.9,
    available_slots: ["Today 4:30 PM", "Tomorrow 10:00 AM", "Tomorrow 2:00 PM"],
    email: "sharma@dermascan.com",
    password: "123"
  },
  {
    id: "DOC-102",
    name: "Dr. Priya Patel",
    title: "Clinical Dermatologist & Trichologist",
    specialties: ["Acne", "Eczema", "Warts"],
    hospital: "City Care Dermatology Center",
    experience_years: 9,
    rating: 4.8,
    available_slots: ["Today 5:30 PM", "Tomorrow 11:30 AM", "Friday 3:00 PM"],
    email: "patel@dermascan.com",
    password: "123"
  },
  {
    id: "DOC-103",
    name: "Dr. Vikram Rao",
    title: "Dermato-Surgeon & Specialist",
    specialties: ["Melanoma", "Onychomycosis", "Warts"],
    hospital: "Metro Health Institute",
    experience_years: 18,
    rating: 4.95,
    available_slots: ["Tomorrow 9:00 AM", "Tomorrow 1:00 PM", "Saturday 11:00 AM"],
    email: "rao@dermascan.com",
    password: "123"
  }
];

// 2. Registered Patients
let patients = [
  {
    id: "PT-1042",
    name: "Vamsi Krishna",
    age: 22,
    gender: "Male",
    phone: "+91 98765 43210",
    email: "vamsi@patient.com",
    password: "123",
    created_at: "2026-11-15 10:20:00"
  },
  {
    id: "PT-1043",
    name: "Sneha Reddy",
    age: 26,
    gender: "Female",
    phone: "+91 98450 12345",
    email: "sneha@patient.com",
    password: "123",
    created_at: "2026-11-15 11:45:00"
  }
];

// 3. Clinical Cases (With GPS Coordinates & High-Res Lesion Photos)
let cases = [
  {
    id: "CASE-901",
    patient_id: "PT-1042",
    patient_name: "Vamsi Krishna",
    disease: "Melanoma",
    confidence: 84.6,
    severity: "High Priority Alert",
    latitude: 16.494356,
    longitude: 80.501303,
    gps_status: "GPS Locked (5 sats)",
    image_url: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80",
    kiosk_id: "Kiosk_01",
    created_at: "2026-11-16 14:22:10",
    color: "#ef4444"
  },
  {
    id: "CASE-902",
    patient_id: "PT-1043",
    patient_name: "Sneha Reddy",
    disease: "Eczema",
    confidence: 89.2,
    severity: "Moderate Attention",
    latitude: 16.495210,
    longitude: 80.502840,
    gps_status: "GPS Locked (6 sats)",
    image_url: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80",
    kiosk_id: "Kiosk_01",
    created_at: "2026-11-16 16:05:40",
    color: "#f97316"
  },
  {
    id: "CASE-903",
    patient_id: "PT-1044",
    patient_name: "Arjun Verma",
    disease: "Acne",
    confidence: 94.1,
    severity: "Routine Consultation",
    latitude: 16.493890,
    longitude: 80.500450,
    gps_status: "GPS Locked (5 sats)",
    image_url: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&auto=format&fit=crop&q=80",
    kiosk_id: "Kiosk_01",
    created_at: "2026-11-16 17:10:15",
    color: "#0ea5e9"
  },
  {
    id: "CASE-904",
    patient_id: "PT-1045",
    patient_name: "Kavita Rao",
    disease: "Vitiligo",
    confidence: 91.5,
    severity: "Moderate Attention",
    latitude: 16.496150,
    longitude: 80.503900,
    gps_status: "GPS Locked (4 sats)",
    image_url: "https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?w=600&auto=format&fit=crop&q=80",
    kiosk_id: "Kiosk_01",
    created_at: "2026-11-16 18:30:20",
    color: "#a855f7"
  }
];

// 4. Appointments
let appointments = [
  {
    id: "APT-501",
    patient_id: "PT-1042",
    patient_name: "Vamsi Krishna",
    patient_phone: "+91 98765 43210",
    doctor_id: "DOC-101",
    doctor_name: "Dr. A. Sharma",
    disease: "Melanoma",
    confidence: 84.6,
    severity: "High Priority Alert",
    slot: "Today 4:30 PM",
    image_url: "https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600&auto=format&fit=crop&q=80",
    latitude: 16.494356,
    longitude: 80.501303,
    status: "Confirmed",
    doctor_notes: "Patient advised to avoid sun exposure and refrain from scratching. Biopsy schedule planned.",
    created_at: "2026-11-16 14:30:00"
  },
  {
    id: "APT-502",
    patient_id: "PT-1043",
    patient_name: "Sneha Reddy",
    patient_phone: "+91 98450 12345",
    doctor_id: "DOC-102",
    doctor_name: "Dr. Priya Patel",
    disease: "Eczema",
    confidence: 89.2,
    severity: "Moderate Attention",
    slot: "Tomorrow 11:30 AM",
    image_url: "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80",
    latitude: 16.495210,
    longitude: 80.502840,
    status: "Pending Review",
    doctor_notes: "Keep area hydrated with fragrance-free emollient until tomorrow's clinic review.",
    created_at: "2026-11-16 16:15:00"
  }
];

// 5. Kiosk Hardware State
let kioskState = {
  id: "kiosk_01",
  name: "VIT-AP IoT Kiosk Unit #1",
  status: "Available", // "Available" | "In Use"
  current_patient: null,
  current_patient_id: null,
  session_started_at: null,
  stream_url: "/api/scanner/video_feed",
  last_ping: new Date().toISOString()
};

// 6. Pre-Care Guidelines (Do's and Don'ts)
const PRE_CARE_REMEDIES = {
  "Melanoma": {
    severity: "High Priority Alert",
    color: "#ef4444",
    dos: [
      "Keep the lesion covered from direct UV sunlight.",
      "Document any rapid changes in color, size, or shape.",
      "Attend urgent clinical evaluation within 24-48 hours."
    ],
    donts: [
      "Do NOT scratch, pick, puncture, or apply pressure.",
      "Do NOT apply unverified home herbal pastes or chemical bleaches.",
      "Do NOT delay formal dermatological biopsy."
    ]
  },
  "Eczema": {
    severity: "Moderate Attention",
    color: "#f97316",
    dos: [
      "Apply gentle, fragrance-free emollient moisturizer frequently.",
      "Take lukewarm baths (under 10 mins) instead of hot showers.",
      "Wear loose, breathable 100% cotton clothing."
    ],
    donts: [
      "Do NOT use harsh antibacterial or perfumed soaps.",
      "Avoid direct contact with wool, rough fabrics, or sudden temperature shifts.",
      "Avoid vigorous towel rubbing after bathing."
    ]
  },
  "Acne": {
    severity: "Routine Consultation",
    color: "#0ea5e9",
    dos: [
      "Wash face gently twice daily with a mild foaming cleanser.",
      "Use oil-free, non-comedogenic sunscreen and moisturizer.",
      "Maintain clean pillowcases and sanitize phone screens."
    ],
    donts: [
      "Do NOT squeeze, pick, or pop blemishes (prevents scarring).",
      "Avoid aggressive facial scrubs that aggravate inflammation.",
      "Avoid touching your face frequently with unwashed hands."
    ]
  },
  "Vitiligo": {
    severity: "Moderate Attention",
    color: "#a855f7",
    dos: [
      "Apply broad-spectrum SPF 50+ sunscreen on depigmented patches.",
      "Protect skin from cuts, scrapes, and mechanical friction.",
      "Discuss phototherapy or topical immunomodulators with your doctor."
    ],
    donts: [
      "Avoid sunburns on depigmented skin lacking melanin protection.",
      "Avoid stress triggers and harsh chemical skin bleaches.",
      "Do NOT get tattoos in affected areas (prevents Koebner phenomenon)."
    ]
  },
  "Warts": {
    severity: "Routine Consultation",
    color: "#22c55e",
    dos: [
      "Keep affected area dry and clean.",
      "Wash hands thoroughly after touching the lesion.",
      "Consult doctor for cryotherapy or targeted topical treatments."
    ],
    donts: [
      "Do NOT share personal towels, razors, or socks with family members.",
      "Do NOT pick, shave over, or scratch warts (prevents viral spreading).",
      "Do NOT walk barefoot in communal gym showers or public pool decks."
    ]
  },
  "Onychomycosis": {
    severity: "Moderate Attention",
    color: "#eab308",
    dos: [
      "Keep nails trimmed straight across and filed thin.",
      "Wear moisture-wicking synthetic socks and breathable footwear.",
      "Dry feet and toe-web spaces thoroughly after bathing."
    ],
    donts: [
      "Avoid walking barefoot in damp locker rooms or swimming areas.",
      "Do NOT share nail clippers or emery boards.",
      "Avoid wearing damp, sweat-soaked shoes two days in a row."
    ]
  }
};

module.exports = {
  doctors,
  patients,
  cases,
  appointments,
  kioskState,
  PRE_CARE_REMEDIES
};
