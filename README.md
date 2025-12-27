# 🎆 Happy New Year 2026 Experience

A cinematic, interactive 3D web experience designed to celebrate the New Year. It features gesture-controlled visuals that transform from a floating "2026" text into a spectacular galaxy explosion, accompanied by a personalized photo gallery and heartfelt messages.

## ✨ Features

- **Interactive Transformation**:
  - **Open Hand**: Reveals the year **"2026"** with a crown of floating photo memories.
  - **Fist (Close Hand)**: Triggers a **Galaxy Explosion**, hiding the photos to reveal a personal message card ("For You").
- **Gesture Control**: Use your webcam to rotate the view (Hand movement) and switch modes (Open/Fist).
- **Personalized Gallery**: Upload your own photos which are displayed as glowing Polaroid frames floating in 3D space.
- **Countdown Timer**: Real-time countdown to January 1st, 2026.
- **Atmospheric Visuals**: High-fidelity bloom, cinema-quality lighting, and particle effects using React Three Fiber.

## 🛠️ Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd happy-new-year-2026-experience
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```
   *Note: The `postinstall` script will automatically download the required AI model for gesture control.*

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to `http://localhost:5173` (or the port shown in your terminal).
   - Allow camera access for gesture control.

## 🎯 How to Use

### 1. Gesture Controls (Webcam)
- **Position your hand** in front of the camera (preview in top-right corner).
- **Move Hand**: Rotates the camera view (Look around).
- **Open Hand (✋)**: Shows "2026" text and your Photo Gallery.
- **Close Fist (✊)**: Explodes the scene into a Galaxy and shows the "New Year Message".

### 2. Photo Upload
- Click the **"Upload Photos"** button in the bottom-right corner.
- Select up to 22 images.
- They will appear floating above the "2026" text.

### 3. Sharing (Optional)
- To enable cloud sharing (sending a link to friends), you need to configure **Cloudflare R2** credentials in `.env.local`.
- If running locally without configuration, photos are saved only in your browser (LocalStorage).

## 🏗️ Tech Stack

- **Framework**: React 19, Vite
- **3D Engine**: React Three Fiber (Three.js)
- **AI/Vision**: MediaPipe (Hand Gesture Recognition)
- **Styling**: Tailwind CSS
- **Effects**: React Three Postprocessing (Bloom, Vignette)

## 🥂 Happy New Year!

May your 2026 be as bright and spectacular as this galaxy! ✨
