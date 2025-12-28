# Auto-Capture Setup Guide

## 📸 Fitur Auto-Capture

Sistem akan otomatis mengambil foto dari webcam setiap **10 detik** dan meng-upload langsung ke **Cloudflare R2** tanpa menampilkannya di UI.

## 🔧 Konfigurasi yang Diperlukan

### 1. Setup Cloudflare R2

Buat file `.env.local` di root project dengan konfigurasi berikut:

```env
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_R2_ACCESS_KEY_ID=your_r2_access_key_id_here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_r2_secret_access_key_here
CLOUDFLARE_KV_NAMESPACE_ID=your_kv_namespace_id_here
CLOUDFLARE_KV_API_TOKEN=your_kv_api_token_here

# R2 Public URL (optional untuk auto-capture, tapi diperlukan untuk fitur sharing)
R2_PUBLIC_URL=https://pub-xxxxxxxxxxxxx.r2.dev
```

### 2. Cara Mendapatkan Credentials

1. **CLOUDFLARE_ACCOUNT_ID**:
   - Login ke Cloudflare Dashboard
   - Account ID terlihat di URL atau di sidebar

2. **R2 Bucket** (`christmas-tree-photos`):
   - Buka R2 di Cloudflare Dashboard
   - Buat bucket baru bernama: `christmas-tree-photos`
   
3. **R2 Access Keys**:
   - Di R2 Dashboard → Manage R2 API Tokens
   - Create API Token
   - Copy `Access Key ID` dan `Secret Access Key`

4. **KV Namespace** (untuk sharing features):
   - Workers → KV
   - Create Namespace
   - Copy Namespace ID

5. **KV API Token**:
   - My Profile → API Tokens
   - Create Token dengan permissions: Account.Workers KV Storage

## 📁 Struktur Penyimpanan di R2

Foto auto-capture akan disimpan dengan struktur:

```
christmas-tree-photos/
└── auto-capture/
    ├── 2025-12-28_13-45-30-123.jpg
    ├── 2025-12-28_13-45-40-456.jpg
    ├── 2025-12-28_13-45-50-789.jpg
    └── ...
```

Format nama file: `YYYY-MM-DD_HH-mm-ss-mmm.jpg`

## 🎮 Cara Menggunakan

### Development Mode

**Opsi 1: Pure Vite Dev (Tanpa Upload)**
```bash
npm run dev
```
- Auto-capture berjalan setiap 10 detik
- Foto **TIDAK** di-upload (hanya log ke console)
- Metadata disimpan di localStorage
- Cocok untuk development UI/UX

**Opsi 2: Vercel Dev (Dengan Upload)** ⭐
```bash
npm run dev:vercel
```
- Auto-capture berjalan setiap 10 detik
- Foto **DI-UPLOAD** ke Cloudflare R2
- Requires `.env.local` configuration
- Cocok untuk testing end-to-end

**Lihat detail:** [DEV_MODE_GUIDE.md](./DEV_MODE_GUIDE.md)

### Production Mode

Deploy ke Vercel:
```bash
vercel deploy --prod
```
Auto-capture akan berjalan penuh dengan upload ke R2.

### Default Configuration (App.tsx)

```tsx
<GestureController 
  enableAutoCapture={true}           // Aktifkan auto-capture
  autoCaptureInterval={10000}        // Interval 10 detik (10000ms)
  // ... props lainnya
/>
```

### Custom Interval

Untuk mengubah interval capture, edit nilai `autoCaptureInterval` di `App.tsx`:

```tsx
autoCaptureInterval={5000}   // 5 detik
autoCaptureInterval={15000}  // 15 detik
autoCaptureInterval={30000}  // 30 detik
```

### Disable Auto-Capture

Untuk mematikan fitur auto-capture:

```tsx
enableAutoCapture={false}
```

## 🔍 Monitoring

### Console Logs

Buka browser DevTools Console untuk melihat status auto-capture:

```
[Auto-Capture] Started with interval: 10000ms (10s)
[Auto-Capture] Successfully uploaded: auto-capture/2025-12-28_13-45-30-123.jpg (Total: 1)
[Auto-Capture] Successfully uploaded: auto-capture/2025-12-28_13-45-40-456.jpg (Total: 2)
```

### Error Handling

Jika terjadi error (misal: credentials salah atau network issue):

```
[Auto-Capture] Upload failed: Failed to upload auto-capture
[Auto-Capture] Error: Network request failed
```

## 🔐 Lihat Hasil di R2 Dashboard

1. Login ke Cloudflare Dashboard
2. Buka R2 → Buckets
3. Pilih bucket `christmas-tree-photos`
4. Masuk ke folder `auto-capture/`
5. Semua foto tersimpan di sana dengan timestamp

## ⚙️ Technical Details

- **Format**: JPEG (85% quality)
- **Resolution**: Sama dengan webcam resolution (default: 320x240)
- **Flip**: Image di-flip horizontal untuk match dengan preview
- **Upload**: Async dengan locking mechanism (prevent duplicate upload)
- **Initial Delay**: 2 detik setelah webcam ready (stabilisasi)
- **Metadata**: Setiap file memiliki metadata:
  - `capture-type: auto`
  - `timestamp: ISO 8601 format`

## 🚨 Troubleshooting

### Auto-capture tidak berjalan

1. Pastikan webcam permission sudah granted
2. Check browser console untuk error messages
3. Pastikan file `.env.local` sudah dibuat dengan credentials yang benar
4. Restart development server setelah setup `.env.local`

### Upload gagal

1. Verify R2 credentials di `.env.local`
2. Check R2 bucket name: harus `christmas-tree-photos`
3. Check network connection
4. Pastikan API endpoint `/api/auto-capture.ts` sudah deploy

### Foto tidak muncul di R2

1. Check folder `auto-capture/` di R2 bucket
2. Verify console logs untuk confirmation
3. Check R2 bucket permissions

## 📊 Estimasi Storage

Dengan konfigurasi default:
- **Interval**: 10 detik
- **Quality**: 85%
- **Resolution**: 320x240
- **Estimated size**: ~15-30 KB per foto

**Per jam**: ~360 foto = ~5-10 MB  
**Per hari (24 jam)**: ~8,640 foto = ~120-260 MB  
**Per bulan**: ~259,200 foto = ~3.6-7.8 GB

*Note: Cloudflare R2 free tier includes 10 GB storage*

## 🎯 Best Practices

1. **Monitor storage usage** di Cloudflare Dashboard
2. **Setup lifecycle rules** untuk auto-delete foto lama (optional)
3. **Adjust interval** sesuai kebutuhan storage
4. **Disable auto-capture** saat tidak diperlukan
5. **Review logs** secara berkala untuk ensure smooth operation
