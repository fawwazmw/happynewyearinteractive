# 🔧 Development Mode Guide

## 🚀 2 Cara Menjalankan Development Server

### 1️⃣ Pure Vite Dev (Tanpa API Upload)

```bash
npm run dev
```

**Karakteristik:**
- ✅ Fast reload
- ✅ Auto-capture berjalan (capture foto setiap 10 detik)
- ❌ **Upload ke R2 tidak aktif** (API endpoint tidak tersedia)
- ℹ️ Foto hanya di-log ke console
- ℹ️ Metadata disimpan di localStorage untuk debugging

**Console Output:**
```
[Auto-Capture] Started with interval: 10000ms (10s)
[Auto-Capture] Development mode - photo captured (45.23 KB)
[Auto-Capture] To enable upload, run with: npm run dev:vercel
```

**Kapan menggunakan:**
- Development UI/UX
- Testing gesture control
- Fast iteration tanpa perlu R2 setup

---

### 2️⃣ Vercel Dev (Dengan API Upload) ⭐ Recommended untuk Testing Upload

```bash
npm run dev:vercel
```

**Karakteristik:**
- ✅ API endpoints aktif (`/api/*`)
- ✅ Auto-capture + Upload ke R2 berjalan penuh
- ✅ Environment variables dari `.env.local` loaded
- ⚠️ Reload sedikit lebih lambat dibanding pure vite

**Console Output:**
```
[Auto-Capture] Started with interval: 10000ms (10s)
[Auto-Capture] Successfully uploaded: auto-capture/2025-12-28_13-45-30-123.jpg (Total: 1)
[Auto-Capture] Successfully uploaded: auto-capture/2025-12-28_13-45-40-456.jpg (Total: 2)
```

**Kapan menggunakan:**
- Testing upload functionality
- End-to-end testing sebelum deploy
- Verify R2 integration

**Prerequisites:**
1. Install Vercel CLI (jika belum):
   ```bash
   npm install -g vercel
   ```

2. Setup `.env.local`:
   ```bash
   cp env.example .env.local
   # Edit .env.local dengan Cloudflare R2 credentials
   ```

---

## 🌐 Menggunakan Tunnel (Cloudflare/ngrok/etc)

Jika menggunakan tunnel untuk akses dari device lain:

1. **Pastikan vite.config.ts sudah dikonfigurasi** (sudah ditambahkan):
   ```typescript
   server: {
     host: '0.0.0.0',
     allowedHosts: [
       'happynewyearbaby-dev.fwzdev.my.id',
       'localhost',
       '.fwzdev.my.id',
     ],
   }
   ```

2. **Jalankan dengan Vite:**
   ```bash
   npm run dev
   # Tunnel akan forward ke localhost:3010
   ```

3. **Akses via tunnel URL:**
   ```
   https://happynewyearbaby-dev.fwzdev.my.id
   ```

**Note:** Dengan tunnel + pure vite dev, auto-capture akan tetap jalan tapi **upload tidak aktif** (development mode). Untuk enable upload via tunnel, gunakan `vercel dev` dengan tunnel.

---

## 🔍 Debugging Auto-Capture

### Cek Metadata di localStorage (Development Mode)

Buka browser console dan jalankan:

```javascript
// Lihat 5 capture terakhir
JSON.parse(localStorage.getItem('dev_auto_captures'))

// Output example:
[
  {
    "timestamp": "2025-12-28T06:45:30.123Z",
    "size": 46328
  },
  {
    "timestamp": "2025-12-28T06:45:40.456Z",
    "size": 45892
  }
]
```

### Clear Auto-Capture Metadata

```javascript
localStorage.removeItem('dev_auto_captures')
```

---

## 📊 Mode Detection Logic

Code otomatis detect environment:

```typescript
const isProduction = window.location.hostname !== 'localhost' 
                  && window.location.hostname !== '127.0.0.1';

if (!isProduction) {
  // Development mode - console log only
} else {
  // Production/Vercel dev - upload to R2
}
```

**Detection:**
- `localhost` atau `127.0.0.1` → Development mode (no upload)
- Domain lain (including tunnel) → Production mode (upload aktif)

**Note:** Jika menggunakan tunnel di development, code akan detect sebagai production dan **akan coba upload ke API**. Pastikan API tersedia (gunakan `vercel dev`) atau disable auto-capture sementara.

---

## ⚙️ Disable Auto-Capture Sementara

Edit `App.tsx`:

```typescript
<GestureController 
  enableAutoCapture={false}  // ← Set ke false
  // ... props lainnya
/>
```

Atau buat conditional:

```typescript
<GestureController 
  enableAutoCapture={import.meta.env.PROD}  // Hanya aktif di production
  // ... props lainnya
/>
```

---

## 🎯 Workflow Recommendation

### For UI/UX Development:
```bash
npm run dev
# Fast reload, ignore auto-capture errors
```

### For Feature Testing:
```bash
npm run dev:vercel
# Test full functionality including R2 upload
```

### For Production:
```bash
vercel deploy
# atau
npm run build && vercel --prod
```

---

## 🚨 Troubleshooting

### Error: "POST /api/auto-capture 404"

**Penyebab:** Menggunakan `npm run dev` (pure vite) tapi code detect sebagai production mode.

**Solusi:**
1. Gunakan `npm run dev:vercel` untuk enable API
2. Atau edit code untuk force development mode
3. Atau disable auto-capture sementara

### Error: "Command 'vercel' not found"

**Solusi:**
```bash
npm install -g vercel
# atau gunakan npx
npx vercel dev
```

### Upload gagal di vercel dev

**Cek:**
1. File `.env.local` exists dan terisi lengkap
2. Cloudflare credentials valid
3. R2 bucket `christmas-tree-photos` sudah dibuat
4. Check console untuk error details

---

## 📝 Summary

| Mode | Command | Auto-Capture | Upload | Use Case |
|------|---------|-------------|--------|----------|
| Vite Dev | `npm run dev` | ✅ Log only | ❌ | Fast UI development |
| Vercel Dev | `npm run dev:vercel` | ✅ Full | ✅ | Feature testing |
| Production | Deploy to Vercel | ✅ Full | ✅ | Live site |

**Recommendation:** 
- Development → `npm run dev` 
- Pre-deploy testing → `npm run dev:vercel`
