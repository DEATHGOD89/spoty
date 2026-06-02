# 🎵 Spoty - Premium Offline Bento Music Player

Spoty is a state-of-the-art, offline-first bento music player packaged as a native desktop application. It features dynamic, customizable cinematic video backgrounds, hardware GPU layer acceleration (100% lag-free), an advanced DSP Equalizer, and local caching via browser IndexedDB.

---

## 🚀 For Users: How to Install & Play

If you or your friends want to run Spoty as a standalone desktop software on your Windows PC, follow these simple steps:

### 1. Installation
- Navigate to the **`dist-desktop/`** folder.
- Locate the installer named **`Spoty Setup 1.0.0.exe`**.
- **Double-click** the `.exe` file. The installer will instantly configure, set up, and launch Spoty on your PC, placing a shortcut on your Desktop!

### 2. Portable Mode (Alternative)
- If you don't want to install, navigate to **`dist-desktop/win-unpacked/`**.
- Double-click **`Spoty.exe`** to run the application immediately as a portable software. (You can copy this folder to a USB drive and run it on any PC!)

---

## 🎨 How to Use Spoty's Custom Features

Once inside Spoty, explore these interactive features:

*   **Customize Your Profile Name**: Double-click your name in the **Sidebar Footer** (bottom-left) or on the **Header Greeting** (top-left) to change your profile name!
*   **Import Your Songs**: Click the **`+`** button in the sidebar footer or navigate to **Settings** and click **Import Folder** to select and upload your local offline `.mp3` tracks.
*   **Cinematic Backgrounds**: Go to **Settings** -> **Cinematic Background Customizer**. 
    *   Toggle between **🔄 Auto-Rotate** (cycles 6 defaults every 30s) or **🔒 Static Lock** (freezes your favorite loop).
    *   **Customize Speed**: In auto-rotate mode, select your preferred rotation timer (10s, 30s, 1m, 5m, or 10m).
    *   **Upload Your Own Video**: Click **Upload MP4 Video** to add and apply your own custom video background (under 20MB)!
*   **Like Your Favorite Tracks**: Click the **Heart (Like)** button on the bottom audio playback bar to instantly add the active song to your **Liked Songs** library.
*   **Single Song Deletion**: Hover over any song card on the Home Page, Liked Songs page, or Recently Played list, and click the small red **Trash** icon to delete that specific track from your local database.
*   **DSP Audio Equalizer**: Go to the **Equalizer & DSP** panel to select premium bass profiles (Punjabi, Home Theater, Car, DJ), boost clarity, activate vocal protectors, and tune the 10-band equalizer.

---

## 🛠 For Developers: Run & Build From Source

If you want to run Spoty in development mode or build it for other platforms (macOS / Linux), follow these steps:

### Prerequisites
- **Node.js** (v18 or higher recommended)
- **npm** (comes bundled with Node.js)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Browser Development Mode
```bash
npm run dev
```
This boots the application in your local browser environment at `http://localhost:5173`.

### 3. Compile standalone Windows `.exe` Installer
```bash
npm run desktop:build
```
Vite will compile the assets into `dist/`, and `electron-builder` will pack them into a native Windows `.exe` installer inside `dist-desktop/`.

### 4. Package Portable Unpacked Folder
```bash
npm run desktop:package
```
Generates a portable raw directory in `dist-desktop/win-unpacked/` for instant execution and debugging.

---

## 💻 Tech Stack
- **Frontend Framework**: React 19 + Vite 8
- **Database Engine**: Client-side IndexedDB (Offline-first song, playlist, and video Blob storage)
- **Desktop Runtime**: Electron 42 (Sandboxed context isolation, zero remote dependencies)
- **Packaging Engine**: Electron Builder
- **Styling system**: Vanilla CSS + Bento Grid frosted glass components (promoted to GPU compositor layers)
