import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const SECRET_KEY = 'hny2026_secret_key_fwzdev_capture_system';

// XOR cipher
function xorCipher(input: string, key: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

// Encrypt data (server-side, Node.js compatible)
function encryptDataServer(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    const encrypted = xorCipher(jsonStr, SECRET_KEY);
    const base64 = Buffer.from(encrypted, 'binary').toString('base64');
    const noise1 = Math.random().toString(36).substring(2, 8);
    const noise2 = Math.random().toString(36).substring(2, 8);
    return `${noise1}${base64}${noise2}`;
  } catch (error) {
    return '';
  }
}

// Decrypt data (server-side, Node.js compatible)
function decryptDataServer(encryptedData: string): any {
  try {
    // Remove noise (first 6 and last 6 chars)
    const base64 = encryptedData.substring(6, encryptedData.length - 6);
    
    // Base64 decode (Node.js)
    const encrypted = Buffer.from(base64, 'base64').toString('binary');
    
    // Apply XOR cipher (decrypt)
    let decrypted = '';
    for (let i = 0; i < encrypted.length; i++) {
      const charCode = encrypted.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    // Parse JSON
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = 'christmas-tree-photos';

// Helper function to compress and convert image to JPEG
async function compressImage(base64Data: string): Promise<Buffer> {
  // Remove data URL prefix if present
  const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
  return Buffer.from(base64Image, 'base64');
}

// Generate filename with timestamp
function generateFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  
  return `auto-capture/${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}.jpg`;
}

export default async function handler(req: any, res: any) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { payload } = req.body;

    if (!payload || typeof payload !== 'string') {
      return res.status(400).json({ error: 'Invalid payload' });
    }

    // Decrypt payload
    let decrypted;
    try {
      decrypted = decryptDataServer(payload);
    } catch (decryptError) {
      console.error('Decrypt error:', decryptError);
      return res.status(400).json({ error: 'Decryption failed' });
    }
    
    if (!decrypted || !decrypted.d) {
      return res.status(400).json({ error: 'Invalid data structure' });
    }

    const imageData = decrypted.d;

    // Convert base64 to buffer
    const imageBuffer = await compressImage(imageData);

    // Generate unique filename with timestamp
    const filename = generateFilename();

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: filename,
      Body: imageBuffer,
      ContentType: 'image/jpeg',
      Metadata: {
        'capture-type': 'auto',
        'timestamp': new Date().toISOString(),
      },
    });

    await s3Client.send(command);

    // Encrypt response to prevent inspection
    const encryptedResponse = encryptDataServer({
      s: true, // success
      f: filename, // filename
      t: new Date().toISOString(), // timestamp
    });

    return res.status(200).json({
      data: encryptedResponse,
    });
  } catch (error: any) {
    console.error('Handler error:', error);
    // Return error with some details for debugging
    return res.status(500).json({ 
      error: 'Processing failed',
      message: error.message || 'Unknown error'
    });
  }
}
