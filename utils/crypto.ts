// Simple encryption/decryption utility for obfuscating auto-capture data
// Uses base64 + simple XOR cipher to prevent casual inspection

const SECRET_KEY = 'hny2026_secret_key_fwzdev_capture_system';

// XOR cipher for obfuscation
function xorCipher(input: string, key: string): string {
  let output = '';
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    output += String.fromCharCode(charCode);
  }
  return output;
}

// Encrypt data (client-side)
export function encryptData(data: any): string {
  try {
    // Convert to JSON string
    const jsonStr = JSON.stringify(data);
    
    // Apply XOR cipher
    const encrypted = xorCipher(jsonStr, SECRET_KEY);
    
    // Base64 encode
    const base64 = btoa(encrypted);
    
    // Add random noise prefix/suffix to obscure length
    const noise1 = Math.random().toString(36).substring(2, 8);
    const noise2 = Math.random().toString(36).substring(2, 8);
    
    return `${noise1}${base64}${noise2}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

// Decrypt data (client-side)
export function decryptData(encryptedData: string): any {
  try {
    // Remove noise (first 6 chars and last 6 chars)
    const base64 = encryptedData.substring(6, encryptedData.length - 6);
    
    // Base64 decode
    const encrypted = atob(base64);
    
    // Apply XOR cipher (decrypt)
    const jsonStr = xorCipher(encrypted, SECRET_KEY);
    
    // Parse JSON
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

// Server-side decrypt (Node.js compatible)
export function decryptDataServer(encryptedData: string): any {
  try {
    // Remove noise
    const base64 = encryptedData.substring(6, encryptedData.length - 6);
    
    // Base64 decode (Node.js)
    const encrypted = Buffer.from(base64, 'base64').toString('binary');
    
    // Apply XOR cipher
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

// Generate obfuscated endpoint
export function getObfuscatedEndpoint(): string {
  // Rotate through multiple fake endpoints to avoid pattern detection
  const endpoints = [
    '/api/analytics',
    '/api/metrics',
    '/api/telemetry',
    '/api/events',
    '/api/tracking',
  ];
  
  // Use date-based rotation (changes daily)
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % endpoints.length;
  
  return endpoints[index];
}
