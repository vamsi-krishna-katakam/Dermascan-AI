// ============================================================================
// ☁️ CLOUDINARY UPLOAD SERVICE (Zero Dependencies - Native Node.js Fetch & Crypto)
// Supports permanent cloud storage on Vercel with local fallback for offline demos
// ============================================================================
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'vid2az8d';
const API_KEY = process.env.CLOUDINARY_API_KEY || '345735157358773';
const API_SECRET = process.env.CLOUDINARY_API_SECRET || '6-eE17LWkmlYzLe5aJFEh0pGlhk';

/**
 * Uploads a base64 image data URL to Cloudinary.
 * Falls back to local disk storage if offline or Cloudinary fails.
 *
 * @param {string} base64DataUrl - "data:image/jpeg;base64,..."
 * @param {string} caseId - e.g. "CASE-917"
 * @returns {Promise<string>} - The permanent image URL (Cloudinary HTTPS or local /uploads/cases/...)
 */
async function uploadLesionImage(base64DataUrl, caseId) {
  if (!base64DataUrl || !base64DataUrl.startsWith('data:image/')) {
    return base64DataUrl || 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600';
  }

  // 1. Try Cloudinary Cloud Upload
  if (CLOUD_NAME && API_KEY && API_SECRET) {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = 'dermascan_cases';
      const publicId = `lesion_${caseId}_${Date.now()}`;

      // Signature: sorted parameters + API_SECRET (alphabetical: folder, public_id, timestamp)
      const stringToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${API_SECRET}`;
      const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

      const payload = {
        file: base64DataUrl,
        api_key: API_KEY,
        timestamp: timestamp,
        folder: folder,
        public_id: publicId,
        signature: signature
      };

      const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data.secure_url) {
          console.log(`☁️ [Cloudinary] Successfully uploaded lesion to: ${data.secure_url}`);
          return data.secure_url;
        }
      } else {
        const errText = await response.text();
        console.warn(`⚠️ [Cloudinary] Upload responded with ${response.status}: ${errText}. Falling back to local storage.`);
      }
    } catch (cloudErr) {
      console.warn(`⚠️ [Cloudinary] Note: ${cloudErr.message}. Falling back to local storage.`);
    }
  }

  // 2. Fallback: Save to Local Disk (for local dev / offline viva presentation)
  try {
    const base64Data = base64DataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const filename = `lesion_${caseId}_${Date.now()}.jpg`;
    const uploadDir = path.join(__dirname, '../public/uploads/cases');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, filename), buffer);
    console.log(`💾 [Local Storage] Saved lesion image locally: /uploads/cases/${filename}`);
    return `/uploads/cases/${filename}`;
  } catch (fsErr) {
    console.error('❌ Could not save image to local disk (e.g. read-only environment):', fsErr.message);
    return 'https://images.unsplash.com/photo-1576765608535-5f04d1e3f289?w=600';
  }
}

module.exports = {
  uploadLesionImage,
  CLOUD_NAME,
  API_KEY
};
