import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Plus, 
  Library, 
  FolderPlus, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Repeat, 
  Shuffle, 
  Sliders, 
  Heart,
  Music, 
  Folder,
  Settings,
  Bell,
  Trash2,
  X,
  Home,
  Disc,
  User,
  ListMusic,
  Download,
  Menu,
  CheckCircle,
  Globe
} from 'lucide-react';

import UploadModal from './components/UploadModal/UploadModal';
import { 
  getAllSongs, 
  saveSong, 
  deleteSong, 
  getAllPlaylists, 
  savePlaylist, 
  deletePlaylist,
  getAllBackgrounds,
  saveBackground,
  deleteBackground
} from './services/db';
import { seedInitialSongsIfEmpty } from './services/seeder';
import {
  getCloudSongs,
  uploadSongToCloud,
  likeCloudSong,
  deleteCloudSong,
  isSupabaseConfigured
} from './services/supabase';
import { generateCoverGradient } from './components/SongCard/SongCard';

import './App.css';

// ==========================================================================
// SYNCHRONOUS CACHE & UTILITY ENGINE: Eliminates image/audio flickering & visual lag
// ==========================================================================
const coverUrlCache = new Map();
const folderCollageCache = new Map();
const audioUrlCache = new Map();
const customBgUrlCache = new Map();

const formatTime = (secs) => {
  if (isNaN(secs) || secs === undefined || secs === null) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const getCoverUrl = (track) => {
  if (!track) return null;
  if (track.coverUrl) return track.coverUrl; // Firebase Cloud Image URL
  if (!track.coverBlob) return null;
  if (!coverUrlCache.has(track.id)) {
    coverUrlCache.set(track.id, URL.createObjectURL(track.coverBlob));
  }
  return coverUrlCache.get(track.id);
};

const getCustomBgUrl = (bg) => {
  if (!bg || !bg.blob) return null;
  if (!customBgUrlCache.has(bg.id)) {
    customBgUrlCache.set(bg.id, URL.createObjectURL(bg.blob));
  }
  return customBgUrlCache.get(bg.id);
};

const getFolderCovers = (folderName, songs) => {
  if (!folderCollageCache.has(folderName)) {
    const folderSongs = songs.filter(s => (s.album === folderName || (!s.album && folderName === 'Music Folder')));
    const coverBlobs = folderSongs.map(s => s.coverBlob).filter(Boolean).slice(0, 4);
    const urls = coverBlobs.map(blob => URL.createObjectURL(blob));
    folderCollageCache.set(folderName, urls);
  }
  return folderCollageCache.get(folderName);
};

const clearCoverCaches = () => {
  for (const url of coverUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  coverUrlCache.clear();
  
  for (const urls of folderCollageCache.values()) {
    urls.forEach(url => URL.revokeObjectURL(url));
  }
  folderCollageCache.clear();

  for (const url of audioUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  audioUrlCache.clear();

  for (const url of customBgUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  customBgUrlCache.clear();
};

// ==========================================================================
// COMPONENT: TrackCover (Synchronous, zero-flicker, memory-leak-safe cover art)
// ==========================================================================
function TrackCover({ track, className = "", size = "small" }) {
  const url = getCoverUrl(track);

  if (url) {
    return <img src={url} alt={track.title} className={className} />;
  }

  const grad = track.coverGradient || generateCoverGradient(track.title);
  return (
    <div 
      className={`${className} fallback-gradient`} 
      style={{ background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800 }}
    >
      {track.title.substring(0, size === "large" ? 2 : 1).toUpperCase()}
    </div>
  );
}

// ==========================================================================
// COMPONENT: FolderCollage (Synchronous dynamic collage generator)
// ==========================================================================
function FolderCollage({ folderName, songs }) {
  const urls = getFolderCovers(folderName, songs);

  if (urls.length >= 4) {
    return (
      <div className="folder-collage grid-2x2">
        {urls.map((url, i) => <img key={i} src={url} alt="" className="collage-tile" />)}
      </div>
    );
  } else if (urls.length >= 2) {
    return (
      <div className="folder-collage grid-1x2">
        {urls.slice(0, 2).map((url, i) => <img key={i} src={url} alt="" className="collage-tile" />)}
      </div>
    );
  } else if (urls.length === 1) {
    return <img src={urls[0]} alt="" className="folder-collage-full" />;
  }

  const grad = generateCoverGradient(folderName);
  return (
    <div className="folder-collage-gradient" style={{ background: grad }}>
      <Folder size={28} className="text-white" />
    </div>
  );
}

const DEFAULT_BG_LIST = [
  { id: 'default-1', name: 'Toji (No Cursed Energy)', src: 'bg_toji.jpg', isDefault: true, isImage: true },
  { id: 'default-2', name: 'Zoro (King of Hell)', src: 'bg_zoro.jpg', isDefault: true, isImage: true },
  { id: 'default-3', name: 'Eren (Freedom)', src: 'bg_eren.jpg', isDefault: true, isImage: true },
  { id: 'default-4', name: 'Goku (Ultra Instinct)', src: 'bg_goku.jpg', isDefault: true, isImage: true },
  { id: 'default-5', name: 'Itachi (Genjutsu Master)', src: 'bg_itachi.jpg', isDefault: true, isImage: true },
];

// ==========================================================================
// MAIN REACT WEB APPLICATION CONTAINER
// ==========================================================================
export default function App() {
  // --- ROTATING VIDEO BACKGROUND STATES ---
  const [bgVideoIndex, setBgVideoIndex] = useState(0);
  const [customBackgrounds, setCustomBackgrounds] = useState([]);
  const [hiddenDefaultBgs, setHiddenDefaultBgs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('spoty_hidden_default_bgs') || '[]');
    } catch { return []; }
  });
  const [bgMode, setBgMode] = useState(() => {
    return localStorage.getItem('spoty_bg_mode') || 'static';
  });
  const [activeBgId, setActiveBgId] = useState(() => {
    return localStorage.getItem('spoty_active_bg_id') || 'default-1';
  });
  const [bgRotateTime, setBgRotateTime] = useState(() => {
    return parseInt(localStorage.getItem('spoty_bg_rotate_time') || '30', 10);
  });

  // Derive the list of visible (non-hidden) default backgrounds
  const visibleDefaultBgs = DEFAULT_BG_LIST.filter(bg => !hiddenDefaultBgs.includes(bg.id));
  const visibleDefaultVideos = visibleDefaultBgs.map(bg => bg.src);

  useEffect(() => {
    if (bgMode !== 'rotate') return;
    if (visibleDefaultVideos.length === 0) return; // nothing to rotate
    const intervalMs = bgRotateTime * 1000;
    const interval = setInterval(() => {
      setBgVideoIndex((prev) => (prev + 1) % visibleDefaultVideos.length);
    }, intervalMs); // cycle background dynamically
    return () => clearInterval(interval);
  }, [bgMode, bgRotateTime, visibleDefaultVideos.length]);

  // --- BACKGROUND VIDEO STREAM RESOLVER ---
  const getActiveBackgroundSrc = () => {
    if (bgMode === 'disabled') {
      return '';
    }
    if (bgMode === 'rotate') {
      if (visibleDefaultVideos.length === 0) return '';
      return visibleDefaultVideos[bgVideoIndex % visibleDefaultVideos.length];
    }
    if (activeBgId.startsWith('default-')) {
      // Check if this default was hidden
      if (hiddenDefaultBgs.includes(activeBgId)) {
        // Fall back to first visible default or empty
        return visibleDefaultVideos.length > 0 ? visibleDefaultVideos[0] : '';
      }
      const match = DEFAULT_BG_LIST.find(b => b.id === activeBgId);
      return match ? match.src : '';
    }
    const matchCustom = customBackgrounds.find(b => b.id === activeBgId);
    if (matchCustom) {
      const url = getCustomBgUrl(matchCustom);
      return url || '';
    }
    return '';
  };

  const isActiveBackgroundAnImage = () => {
    if (bgMode === 'disabled') return false;
    if (bgMode === 'rotate') {
      const activeDefault = visibleDefaultBgs[bgVideoIndex % visibleDefaultBgs.length];
      return activeDefault ? !!activeDefault.isImage : false;
    }
    if (activeBgId.startsWith('default-')) {
      const match = DEFAULT_BG_LIST.find(b => b.id === activeBgId);
      return match ? !!match.isImage : false;
    }
    const matchCustom = customBackgrounds.find(b => b.id === activeBgId);
    return matchCustom ? !!matchCustom.isImage : false;
  };

  const handleSelectBackground = (id) => {
    setActiveBgId(id);
    localStorage.setItem('spoty_active_bg_id', id);
    setBgMode('static');
    localStorage.setItem('spoty_bg_mode', 'static');
    triggerNotification("Background locked!");
  };

  const handleUploadBackground = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      triggerNotification("File too large! Select a file < 20MB.", "error");
      return;
    }

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      triggerNotification("Please upload a valid Image (PNG/JPG) or MP4 Video.", "error");
      return;
    }

    try {
      const bgData = {
        id: 'bg-custom-' + Date.now(),
        name: file.name.substring(0, 24) || 'Custom Background',
        blob: file,
        isImage: isImage,
        addedAt: Date.now()
      };

      await saveBackground(bgData);
      setCustomBackgrounds(prev => [bgData, ...prev]);

      setActiveBgId(bgData.id);
      localStorage.setItem('spoty_active_bg_id', bgData.id);
      setBgMode('static');
      localStorage.setItem('spoty_bg_mode', 'static');

      triggerNotification("Custom background applied!");
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to save custom background.", "error");
    }
  };

  const handleDeleteBackground = async (id, e) => {
    e.stopPropagation();
    if (confirm("Delete this custom background permanently?")) {
      try {
        await deleteBackground(id);
        if (customBgUrlCache.has(id)) {
          URL.revokeObjectURL(customBgUrlCache.get(id));
          customBgUrlCache.delete(id);
        }
        setCustomBackgrounds(prev => prev.filter(b => b.id !== id));
        if (activeBgId === id) {
          setActiveBgId('default-1');
          localStorage.setItem('spoty_active_bg_id', 'default-1');
        }
        triggerNotification("Background video deleted.");
      } catch (err) {
        console.error(err);
        triggerNotification("Failed to delete background.", "error");
      }
    }
  };

  const handleDeleteDefaultBackground = (id, e) => {
    e.stopPropagation();
    if (confirm("Remove this default background video? You can restore it later.")) {
      const updated = [...hiddenDefaultBgs, id];
      setHiddenDefaultBgs(updated);
      localStorage.setItem('spoty_hidden_default_bgs', JSON.stringify(updated));
      setBgVideoIndex(0); // reset rotation index
      if (activeBgId === id) {
        // Switch to rotate mode if the active background was removed
        setBgMode('rotate');
        localStorage.setItem('spoty_bg_mode', 'rotate');
        setActiveBgId('default-1');
        localStorage.setItem('spoty_active_bg_id', 'default-1');
      }
      triggerNotification("Default background removed.");
    }
  };

  const handleRestoreAllDefaultBackgrounds = () => {
    setHiddenDefaultBgs([]);
    localStorage.setItem('spoty_hidden_default_bgs', JSON.stringify([]));
    setBgVideoIndex(0);
    triggerNotification("All default backgrounds restored!");
  };

  // --- CORE APPLICATION STATES ---
  const [userName, setUserName] = useState(() => {
    return localStorage.getItem('spoty_username') || '';
  });
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('spoty_color_theme') || 'terracotta';
  });
  
  // --- CLOUD ONLINE MODE STATES ---
  const [cloudSongs, setCloudSongs] = useState([]);
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [isCloudConfigured, setIsCloudConfigured] = useState(() => isSupabaseConfigured());

  const [sbUrl, setSbUrl] = useState(() => localStorage.getItem('spoty_supabase_url') || '');
  const [sbAnonKey, setSbAnonKey] = useState(() => localStorage.getItem('spoty_supabase_anon_key') || '');

  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [categories, setCategories] = useState([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState([]);
  
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playQueue, setPlayQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);

  const [activePlaylistId, setActivePlaylistId] = useState(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeView, setActiveView] = useState('home'); // 'home', 'library', 'favorites', 'playlists', 'folders', 'equalizer', 'settings'
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [selectedGenreChip, setSelectedGenreChip] = useState('All');
  const [currentSort, setCurrentSort] = useState('Recently Added');

  // --- BULK SELECTION STATES (SETTINGS LIBRARY MANAGER) ---
  const [selectedFolderNames, setSelectedFolderNames] = useState([]);
  const [selectedSongIds, setSelectedSongIds] = useState([]);
  const [songManagerSearch, setSongManagerSearch] = useState('');
  const [songManagerLimit, setSongManagerLimit] = useState(50);
  
  // --- NON-BLOCKING MODAL STATES ---
  const [playlistModal, setPlaylistModal] = useState({ isOpen: false, song: null, mode: 'add' });

  // --- COMPUTED PROPERTIES ---
  const listeningHours = Math.round(songs.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600);

  const filteredManagerSongs = songs.filter(song => {
    if (!songManagerSearch.trim()) return true;
    const q = songManagerSearch.toLowerCase().trim();
    return song.title.toLowerCase().includes(q) || 
           song.artist.toLowerCase().includes(q) || 
           (song.album && song.album.toLowerCase().includes(q));
  });

  const displayedManagerSongs = filteredManagerSongs.slice(0, songManagerLimit);

  // --- DSP STATES ---
  const [eqGains, setEqGains] = useState([0,0,0,0,0,0,0,0,0,0]);
  const [bassProfile, setBassProfile] = useState('Home Theater');
  const [subwooferLevel, setSubwooferLevel] = useState(50);
  const [clarityLevel, setClarityLevel] = useState(50);
  const [volumeBoost, setVolumeBoost] = useState(1.0);

  // --- AUDIO CORE DOM ENDPOINTS ---
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // --- DSP REFS & INIT ---
  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserRef = useRef(null);
  const eqNodesRef = useRef([]);
  const subBassRef = useRef(null);
  const punchBassRef = useRef(null);
  const clarityRef = useRef(null);
  const vocalProtectRef = useRef(null);
  const limiterRef = useRef(null);
  const masterGainRef = useRef(null);

  const initAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const freqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
      const nodes = freqs.map(freq => {
        const filter = ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.414;
        filter.gain.value = 0;
        return filter;
      });
      eqNodesRef.current = nodes;

      const subBass = ctx.createBiquadFilter();
      subBass.type = 'lowshelf';
      subBass.frequency.value = 60;
      subBassRef.current = subBass;

      const punchBass = ctx.createBiquadFilter();
      punchBass.type = 'peaking';
      punchBass.frequency.value = 120;
      punchBass.Q.value = 1.0;
      punchBassRef.current = punchBass;

      const vocalProtect = ctx.createBiquadFilter();
      vocalProtect.type = 'peaking';
      vocalProtect.frequency.value = 1500;
      vocalProtect.Q.value = 1.0;
      vocalProtectRef.current = vocalProtect;

      const clarity = ctx.createBiquadFilter();
      clarity.type = 'highshelf';
      clarity.frequency.value = 4000;
      clarityRef.current = clarity;

      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.0; // Prevent clipping
      limiter.knee.value = 0.0;
      limiter.ratio.value = 20.0;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.050;
      limiterRef.current = limiter;

      const masterGain = ctx.createGain();
      masterGain.value = 1.0;
      masterGainRef.current = masterGain;

      let curr = source;
      curr.connect(analyser);
      curr = analyser;

      nodes.forEach(n => {
        curr.connect(n);
        curr = n;
      });
      curr.connect(vocalProtect);
      vocalProtect.connect(clarity);
      clarity.connect(subBass);
      subBass.connect(punchBass);
      punchBass.connect(limiter);
      limiter.connect(masterGain);
      masterGain.connect(ctx.destination);
    }
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const BASS_PROFILE_MAP = {
    'Studio Bass': { sub: 2, punch: 1 },
    'Home Theater': { sub: 8, punch: 4 },
    'Car Bass': { sub: 10, punch: 6 },
    'DJ Bass': { sub: 6, punch: 8 },
    'Cinema Bass': { sub: 9, punch: 5 },
    'Punjabi Bass': { sub: 8, punch: 7 },
    'Workout Bass': { sub: 7, punch: 8 }
  };

  useEffect(() => {
    const profile = BASS_PROFILE_MAP[bassProfile] || BASS_PROFILE_MAP['Home Theater'];
    const multiplier = subwooferLevel / 50.0;
    
    if (subBassRef.current) subBassRef.current.gain.value = profile.sub * multiplier;
    if (punchBassRef.current) punchBassRef.current.gain.value = profile.punch * multiplier;
    
    if (clarityRef.current) {
        clarityRef.current.gain.value = (clarityLevel / 100.0) * 12.0; 
    }
    
    if (vocalProtectRef.current) {
        vocalProtectRef.current.gain.value = (profile.sub * multiplier > 6) ? 2.0 : 0.0;
    }
    
    if (masterGainRef.current) {
        masterGainRef.current.gain.value = volumeBoost;
    }
  }, [bassProfile, subwooferLevel, clarityLevel, volumeBoost]);

  const handleEqChange = (idx, val) => {
    const newGains = [...eqGains];
    newGains[idx] = val;
    setEqGains(newGains);
    if (eqNodesRef.current[idx]) {
      eqNodesRef.current[idx].gain.value = val;
    }
  };

  const handleResetEq = () => {
    setEqGains([0,0,0,0,0,0,0,0,0,0]);
    eqNodesRef.current.forEach(n => n.gain.value = 0);
  };

  // --- BOOTSTRAP INITIAL DATA ---
  useEffect(() => {
    async function setupApp() {
      await seedInitialSongsIfEmpty();
      await loadLocalData();

      // Customize Profile Username on first load
      let storedName = localStorage.getItem('spoty_username');
      if (!storedName) {
        let name = null;
        while (!name || !name.trim()) {
          name = prompt("Welcome to Spoty! Please enter your name to customize your profile:");
          if (name === null) {
            alert("A profile name is required to personalize your experience.");
            name = '';
          }
        }
        const cleanName = name.trim();
        localStorage.setItem('spoty_username', cleanName);
        setUserName(cleanName);
      }
    }
    setupApp();
    return () => {
      // Clear URL object caches on unmount to refresh assets and free memory
      clearCoverCaches();
    };
  }, []);

  // --- SYNCHRONIZE COLOR THEME ON HTML ROOT ---
  useEffect(() => {
    const rootEl = document.documentElement;
    // Remove existing themes
    rootEl.classList.remove('theme-terracotta', 'theme-black', 'theme-white', 'theme-green', 'theme-orange');
    // Add current theme
    rootEl.classList.add(`theme-${activeTheme}`);

    // Dynamically update browser's mobile navigation/header background theme color
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement('meta');
      themeMeta.name = 'theme-color';
      document.head.appendChild(themeMeta);
    }
    const themeColors = {
      terracotta: '#150608',
      black: '#050505',
      white: '#eef1f6',
      green: '#040d0a',
      orange: '#0f0b07'
    };
    themeMeta.content = themeColors[activeTheme] || '#150608';
  }, [activeTheme]);

  const loadLocalData = async () => {
    try {
      const localSongs = await getAllSongs();
      const localPlaylists = await getAllPlaylists();
      setSongs(localSongs);
      setPlaylists(localPlaylists);

      try {
        const localBgs = await getAllBackgrounds();
        setCustomBackgrounds(localBgs || []);
      } catch (e) {
        console.error('Failed to load custom backgrounds:', e);
      }

      // Extract folders dynamically from local songs
      const folderMap = {};
      localSongs.forEach((song) => {
        const folder = song.album || 'Music Folder';
        if (!folderMap[folder]) {
          folderMap[folder] = { name: folder, count: 0 };
        }
        folderMap[folder].count++;
      });
      setCategories(Object.values(folderMap));

      // Restore recently played
      const savedRecentIds = localStorage.getItem('spoty_recent_ids');
      if (savedRecentIds) {
        try {
          const ids = JSON.parse(savedRecentIds);
          const matched = ids.map(id => localSongs.find(s => s.id === id)).filter(Boolean);
          setRecentlyPlayed(matched);
        } catch (e) {
          console.error(e);
        }
      }
    } catch (err) {
      console.error('Failed to load local DB:', err);
    }
  };

  // --- CLOUD ENGINE METHODS ---
  const loadCloudData = async () => {
    if (!isCloudConfigured) return;
    setIsLoadingCloud(true);
    try {
      const clSongs = await getCloudSongs();
      setCloudSongs(clSongs);
    } catch (err) {
      console.error("Error loading cloud library:", err);
    } finally {
      setIsLoadingCloud(false);
    }
  };

  useEffect(() => {
    if (activeView === 'cloud') {
      loadCloudData();
    }
  }, [activeView, isCloudConfigured]);

  const handleLikeCloudSong = async (songId) => {
    try {
      await likeCloudSong(songId);
      // Update local state state to reflect like increment instantly
      setCloudSongs(prev => 
        prev.map(s => s.id === songId ? { ...s, likes: (s.likes || 0) + 1 } : s)
      );
      triggerNotification("Cloud track liked! ❤️");
    } catch (e) {
      console.error("Failed to like cloud song:", e);
    }
  };

  const handleDeleteCloudSong = async (songId, songTitle) => {
    if (!confirm(`Are you sure you want to permanently delete "${songTitle}" from the cloud library? This will also delete its files and free up your cloud storage.`)) {
      return;
    }
    try {
      await deleteCloudSong(songId);
      setCloudSongs(prev => prev.filter(s => s.id !== songId));
      triggerNotification("Cloud track deleted! 🗑️");
    } catch (e) {
      console.error("Failed to delete cloud song:", e);
      alert("Failed to delete track from cloud: " + e.message);
    }
  };

  const triggerNotification = (message, type = 'success') => {
    // Shorter professional notification message adjustments
    let cleanMsg = message;
    if (message === "Recently played list cleared.") {
      cleanMsg = "Recent History Cleared";
    } else if (message === "All liked songs removed from library.") {
      cleanMsg = "Cleared Liked Songs";
    } else if (message === "Added to Favorites!") {
      cleanMsg = "Added to Favorites ❤️";
    } else if (message === "Removed from Favorites.") {
      cleanMsg = "Removed from Favorites";
    } else if (message === "Playing all songs in random shuffle!") {
      cleanMsg = "Shuffle Enabled 🎵";
    } else if (message.includes("created!")) {
      cleanMsg = "Playlist Created ➕";
    } else if (message === "Removed from playlist.") {
      cleanMsg = "Removed from Playlist";
    } else if (message === "Added to playlist.") {
      cleanMsg = "Added to Playlist ➕";
    } else if (message === "Playlist deleted.") {
      cleanMsg = "Playlist Deleted 🗑";
    }

    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setNotifications(prev => [...prev, { id, message: cleanMsg, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 2200);
  };

  // --- PLAYBACK CONTROLLER ---
  const handlePlaySong = (track, newQueue = []) => {
    setCurrentTrack(track);
    setIsPlaying(true);

    // Save to recently played list
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(s => s.id !== track.id);
      const updated = [track, ...filtered].slice(0, 10);
      localStorage.setItem('spoty_recent_ids', JSON.stringify(updated.map(s => s.id)));
      return updated;
    });

    if (newQueue.length > 0) {
      setPlayQueue(newQueue);
      const index = newQueue.findIndex(s => s.id === track.id);
      setQueueIndex(index >= 0 ? index : 0);
    } else {
      setPlayQueue([track]);
      setQueueIndex(0);
    }
  };

  // Sync actual HTML5 Audio tag sources using unified state synchronizer
  useEffect(() => {
    if (!audioRef.current) return;
    const syncAudioPlayback = async () => {
      if (currentTrack) {
        let url = null;
        if (currentTrack.audioBlob) {
          if (!audioUrlCache.has(currentTrack.id)) {
            audioUrlCache.set(currentTrack.id, URL.createObjectURL(currentTrack.audioBlob));
          }
          url = audioUrlCache.get(currentTrack.id);
        } else if (currentTrack.url) {
          url = currentTrack.url;
        }

        if (url) {
          if (audioRef.current.src !== url) {
            audioRef.current.src = url;
            audioRef.current.load();
          }
          if (isPlaying) {
            initAudioContext();
            try {
              await audioRef.current.play();
            } catch (e) {
              console.log('Playback error:', e);
            }
          } else {
            audioRef.current.pause();
          }
        }
      } else {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
    syncAudioPlayback();
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Audio Events
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleNext = () => {
    if (playQueue.length === 0) return;
    let nextIdx = queueIndex + 1;
    if (isShuffle) {
      nextIdx = Math.floor(Math.random() * playQueue.length);
    } else if (nextIdx >= playQueue.length) {
      nextIdx = 0;
    }
    setQueueIndex(nextIdx);
    setCurrentTrack(playQueue[nextIdx]);
    setIsPlaying(true);
  };

  const handlePrev = () => {
    if (playQueue.length === 0) return;
    let prevIdx = queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = playQueue.length - 1;
    }
    setQueueIndex(prevIdx);
    setCurrentTrack(playQueue[prevIdx]);
    setIsPlaying(true);
  };

  const handleEnded = () => {
    if (isLooping) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log(e));
    } else {
      handleNext();
    }
  };

  // --- VISUALIZER ENGINE ---
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (activeView !== 'equalizer' || !analyserRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let animationId;
    
    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.fillStyle = '#150608'; // deep burgundy background
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;
      
      for (let i = 0; i < bufferLength; i++) {
        barHeight = dataArray[i] / 2.0; // scale down slightly for the 60px height
        const r = barHeight + (25 * (i/bufferLength)) + 140;
        const g = 46;
        const b = 62;
        
        ctx.fillStyle = `rgb(${r},${g},${b})`; // match terracotta theme
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, [activeView, isPlaying]);

  // Save/Upload Folder callback
  const handleUploadTrack = async (songData) => {
    await saveSong(songData);
    await loadLocalData();
  };

  // --- PLAYLIST ACTIONS ---
  const handleCreatePlaylist = async (name) => {
    const pl = {
      id: 'pl-' + Date.now(),
      name: name,
      songIds: [],
      addedAt: Date.now()
    };
    await savePlaylist(pl);
    await loadLocalData();
    triggerNotification(`Playlist "${name}" created!`);
  };

  const handleAddSongToPlaylist = async (songId, plId) => {
    const pl = playlists.find(p => p.id === plId);
    if (!pl) return;
    let updatedIds;
    const currentSongIds = pl.songIds || [];
    if (currentSongIds.includes(songId)) {
      updatedIds = currentSongIds.filter(id => id !== songId);
      triggerNotification('Removed from playlist.');
    } else {
      updatedIds = [...currentSongIds, songId];
      triggerNotification('Added to playlist.');
    }
    await savePlaylist({ ...pl, songIds: updatedIds });
    await loadLocalData();
  };

  const handleToggleFavorite = async (song) => {
    try {
      const isNowFavorite = !song.isFavorite;
      const updatedSong = { ...song, isFavorite: isNowFavorite };
      await saveSong(updatedSong);
      if (currentTrack && currentTrack.id === song.id) {
        setCurrentTrack(updatedSong);
      }
      
      await loadLocalData();
      triggerNotification(isNowFavorite ? 'Added to Favorites!' : 'Removed from Favorites.');
    } catch (err) {
      console.error("Error toggling favorite:", err);
      triggerNotification("Favorites updated successfully!");
    }
  };

  const handleClearRecentlyPlayed = () => {
    if (confirm("Clear your recently played list?")) {
      setRecentlyPlayed([]);
      localStorage.removeItem('spoty_recent_ids');
      triggerNotification("Recently played list cleared.");
    }
  };

  const handleClearAllLikes = async () => {
    if (confirm("Are you sure you want to unlike all songs in your library?")) {
      const likedSongs = songs.filter(s => s.isFavorite);
      for (const song of likedSongs) {
        await saveSong({ ...song, isFavorite: false });
      }
      await loadLocalData();
      triggerNotification("All liked songs removed from library.");
    }
  };

  const handleAddSongToPlaylistCustom = (song) => {
    const activePlaylists = playlists || [];
    if (activePlaylists.length === 0) {
      const plName = prompt("You don't have any playlists yet.\nEnter new Playlist name to create one:");
      if (plName && plName.trim()) {
        handleCreatePlaylist(plName.trim());
      }
    } else {
      setPlaylistModal({ isOpen: true, song, mode: 'add' });
    }
  };

  const handlePlayRandom = () => {
    if (songs.length === 0) return;
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    handlePlaySong(shuffled[0], shuffled);
    setIsShuffle(true);
    triggerNotification("Playing all songs in random shuffle!");
  };

  // --- BULK LIBRARY SELECTION & DELETION HANDLERS ---
  const handleToggleFolderSelect = (folderName) => {
    setSelectedFolderNames(prev => 
      prev.includes(folderName) 
        ? prev.filter(f => f !== folderName) 
        : [...prev, folderName]
    );
  };

  const handleSelectAllFolders = (e) => {
    if (e.target.checked) {
      setSelectedFolderNames(categories.map(c => c.name));
    } else {
      setSelectedFolderNames([]);
    }
  };

  const handleDeleteSelectedFolders = async () => {
    if (selectedFolderNames.length === 0) return;
    if (confirm(`Are you sure you want to delete the ${selectedFolderNames.length} selected folders and all their songs permanently?`)) {
      const songsToDelete = songs.filter(s => selectedFolderNames.includes(s.album || 'Music Folder'));
      for (const song of songsToDelete) {
        await deleteSong(song.id);
      }
      setSelectedFolderNames([]);
      await loadLocalData();
      triggerNotification("Selected folders and songs deleted permanently.");
    }
  };

  const handleDeleteSingleFolder = async (folderName) => {
    if (confirm(`Are you sure you want to delete folder "${folderName}" and all its songs permanently?`)) {
      const songsToDelete = songs.filter(s => (s.album || 'Music Folder') === folderName);
      for (const song of songsToDelete) {
        await deleteSong(song.id);
      }
      setSelectedFolderNames(prev => prev.filter(f => f !== folderName));
      await loadLocalData();
      triggerNotification(`Folder "${folderName}" and its songs deleted permanently.`);
    }
  };

  const handleDeleteAllFolders = async () => {
    if (confirm("Are you sure you want to delete ALL folders and ALL songs permanently?")) {
      for (const song of songs) {
        await deleteSong(song.id);
      }
      setSelectedFolderNames([]);
      setSelectedSongIds([]);
      await loadLocalData();
      triggerNotification("All folders and songs deleted successfully.");
    }
  };

  const handleToggleSongSelect = (songId) => {
    setSelectedSongIds(prev => 
      prev.includes(songId) 
        ? prev.filter(id => id !== songId) 
        : [...prev, songId]
    );
  };

  const handleSelectAllSongs = (e) => {
    if (e.target.checked) {
      setSelectedSongIds(songs.map(s => s.id));
    } else {
      setSelectedSongIds([]);
    }
  };

  const handleDeleteSelectedSongs = async () => {
    if (selectedSongIds.length === 0) return;
    if (confirm(`Are you sure you want to delete the ${selectedSongIds.length} selected songs permanently?`)) {
      for (const id of selectedSongIds) {
        await deleteSong(id);
      }
      setSelectedSongIds([]);
      await loadLocalData();
      triggerNotification("Selected songs deleted permanently.");
    }
  };

  const handleDeleteSingleSong = async (songId, songTitle) => {
    if (confirm(`Are you sure you want to delete song "${songTitle}" permanently?`)) {
      await deleteSong(songId);
      setSelectedSongIds(prev => prev.filter(id => id !== songId));
      await loadLocalData();
      triggerNotification(`Song "${songTitle}" deleted permanently.`);
    }
  };

  // --- QUERY FILTERED LISTS ---
  const getSortedSongs = (songsList) => {
    const listCopy = [...songsList];
    if (currentSort === 'Recently Added') {
      return listCopy.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    if (currentSort === 'Favorites') {
      return listCopy.filter(s => s.isFavorite);
    }
    if (currentSort === 'Artists') {
      return listCopy.sort((a, b) => a.artist.localeCompare(b.artist));
    }
    if (currentSort === 'Albums') {
      return listCopy.sort((a, b) => a.album.localeCompare(b.album));
    }
    return listCopy;
  };

  // Filters by search query and active filters
  const filteredSongs = useMemo(() => {
    return songs.filter((s) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = s.title.toLowerCase().includes(query) || s.artist.toLowerCase().includes(query) || s.genre.toLowerCase().includes(query);
      
      // Chip categories matching
      if (selectedGenreChip === 'All') return matchesSearch;
      if (selectedGenreChip === 'Favorites') return matchesSearch && s.isFavorite;
      
      const chipLabel = selectedGenreChip.toLowerCase();
      const songGenre = s.genre ? s.genre.toLowerCase() : '';
      return matchesSearch && songGenre.includes(chipLabel);
    });
  }, [songs, searchQuery, selectedGenreChip]);

  const displaySongs = useMemo(() => {
    return getSortedSongs(filteredSongs);
  }, [filteredSongs, currentSort]);

  const likedSongsList = useMemo(() => {
    return songs.filter(s => s.isFavorite);
  }, [songs]);

  const librarySongs = useMemo(() => {
    return displaySongs.filter(s => s.isFavorite);
  }, [displaySongs]);

  // Extract unique genres dynamically for filter chips
  const dynamicGenres = useMemo(() => {
    return Array.from(
      new Set(
        songs
          .map((s) => s.genre)
          .filter(Boolean)
          .map((g) => g.trim())
      )
    ).filter((g) => g !== "");
  }, [songs]);

  const genreChips = useMemo(() => {
    return ['All', ...dynamicGenres, 'Favorites'];
  }, [dynamicGenres]);

  // Sidebar navigations helper
  const navigateToView = (viewName) => {
    setActiveView(viewName);
    setSelectedCategory(null);
    setActivePlaylistId(null);
  };

  return (
    <>
      {getActiveBackgroundSrc() && (
        isActiveBackgroundAnImage() ? (
          <img 
            key={`${bgMode}-${activeBgId}-${bgMode === 'rotate' ? bgVideoIndex : ''}`}
            src={getActiveBackgroundSrc()} 
            className="background-image-layer" 
            alt="background"
          />
        ) : (
          <video 
            key={`${bgMode}-${activeBgId}-${bgMode === 'rotate' ? bgVideoIndex : ''}`}
            autoPlay 
            loop 
            muted 
            playsInline
            className="background-video-layer"
          >
            <source src={getActiveBackgroundSrc()} type="video/mp4" />
          </video>
        )
      )}

      <audio 
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />
      {/* Toast Stack (Fixed bottom-right above the player bar) */}
      <div className="toast-stack-container">
        {notifications.map((notif) => {
          let Icon = CheckCircle;
          let iconColor = 'var(--secondary)';
          
          if (notif.type === 'error') {
            Icon = X;
            iconColor = '#ef4444';
          } else if (notif.type === 'info') {
            Icon = Bell;
            iconColor = '#60a5fa';
          } else if (notif.message.includes('Favorites') || notif.message.includes('Favorite') || notif.message.includes('liked') || notif.message.includes('like')) {
            Icon = Heart;
            iconColor = 'var(--secondary)';
          } else if (notif.message.includes('Playlist') || notif.message.includes('playlist')) {
            Icon = Plus;
            iconColor = '#fbbf24';
          } else if (notif.message.includes('Shuffle') || notif.message.includes('shuffle') || notif.message.includes('random')) {
            Icon = Shuffle;
            iconColor = 'var(--accent)';
          } else if (notif.message.includes('Delete') || notif.message.includes('deleted') || notif.message.includes('wiped') || notif.message.includes('removed') || notif.message.includes('clear') || notif.message.includes('Clear')) {
            Icon = Trash2;
            iconColor = '#ef4444';
          }

          return (
            <div key={notif.id} className="premium-toast">
              <div className="toast-icon-wrapper" style={{ color: iconColor }}>
                <Icon size={14} fill={Icon === Heart ? iconColor : 'none'} />
              </div>
              <div className="toast-message">{notif.message}</div>
              <button 
                type="button"
                className="toast-close-btn" 
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className={`app-container ${isSidebarVisible ? '' : 'sidebar-collapsed'}`}>

      {/* ==========================================================================
         SIDEBAR: Spotify-inspired navigation & playlists section
         ========================================================================== */}
      <aside className={`left-sidebar bento-panel ${isSidebarVisible ? '' : 'collapsed'}`}>
        {/* Brand Header */}
        <div className="brand-row">
          <div className="brand-icon-box">
            <Music size={16} className="text-white" />
          </div>
          <span className="brand-title">Spoty</span>
        </div>

        {/* SECTION: Main Menu */}
        <div className="sidebar-section">
          <span className="sidebar-sec-title">Discover</span>
          <button 
            className={`sidebar-nav-btn ${activeView === 'home' ? 'active' : ''}`}
            onClick={() => navigateToView('home')}
          >
            <Home size={16} />
            <span>Home</span>
          </button>
          <button 
            className={`sidebar-nav-btn ${activeView === 'cloud' ? 'active' : ''}`}
            onClick={() => navigateToView('cloud')}
            style={{ position: 'relative' }}
          >
            <Globe size={16} />
            <span>Global Cloud</span>
            <span style={{ 
              fontSize: '0.6rem', 
              background: 'linear-gradient(135deg, var(--secondary) 0%, var(--accent) 100%)', 
              color: 'white', 
              padding: '1px 6px', 
              borderRadius: '8px', 
              marginLeft: 'auto',
              fontWeight: 700 
            }}>
              LIVE
            </span>
          </button>
          <button 
            className={`sidebar-nav-btn ${activeView === 'library' ? 'active' : ''}`}
            onClick={() => navigateToView('library')}
          >
            <Heart size={16} />
            <span>Liked Songs</span>
          </button>
          <button 
            className={`sidebar-nav-btn ${activeView === 'equalizer' ? 'active' : ''}`}
            onClick={() => navigateToView('equalizer')}
          >
            <Sliders size={16} />
            <span>Equalizer & DSP</span>
          </button>
        </div>

        {/* SECTION: Library Containers */}
        <div className="sidebar-section">
          <span className="sidebar-sec-title">Your Space</span>
          <button 
            className={`sidebar-nav-btn ${activeView === 'folders' ? 'active' : ''}`}
            onClick={() => navigateToView('folders')}
          >
            <Folder size={16} />
            <span>Folders</span>
          </button>
          <button 
            className={`sidebar-nav-btn ${activeView === 'playlists' ? 'active' : ''}`}
            onClick={() => navigateToView('playlists')}
          >
            <ListMusic size={16} />
            <span>Playlists</span>
          </button>
        </div>

        {/* SECTION: Collapsed playlists quick navigators */}
        {playlists.length > 0 && (
          <div className="sidebar-section">
            <span className="sidebar-sec-title">Saved Playlists</span>
            <div className="sidebar-playlist-scroll">
              {playlists.map((pl) => {
                const isPlActive = activePlaylistId === pl.id;
                const grad = generateCoverGradient(pl.name);
                
                return (
                  <div 
                    key={pl.id}
                    className={`sidebar-playlist-tile ${isPlActive ? 'active' : ''}`}
                    onClick={() => {
                      setActivePlaylistId(pl.id);
                      setActiveView('playlists');
                      setSelectedCategory(null);
                    }}
                  >
                    <div className="sidebar-playlist-color" style={{ background: grad }} />
                    <span className="truncate">{pl.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* FOOTER PROFILE */}
        <div className="sidebar-footer">
          <div 
            className="user-profile-tile"
            onClick={() => {
              const newName = prompt("Enter your profile name:", userName);
              if (newName && newName.trim()) {
                const clean = newName.trim();
                setUserName(clean);
                localStorage.setItem('spoty_username', clean);
                triggerNotification("Profile name updated!");
              }
            }}
            style={{ cursor: 'pointer' }}
            title="Click to edit profile name"
          >
            <div className="user-avatar-circle">
              <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop" alt={`${userName || 'User'} Avatar`} />
            </div>
            <span className="user-name-lbl">{userName || 'User'}</span>
          </div>
          <button 
            className="sidebar-add-btn" 
            onClick={() => setIsUploadOpen(true)}
            title="Import Music Folder"
          >
            <Plus size={16} />
          </button>
        </div>
      </aside>

      {/* ==========================================================================
         MAIN CORE PANEL VIEWPORT
         ========================================================================== */}
      <main className="main-viewport">
        {/* Header containing search & settings */}
        <header className="bento-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="header-icon-btn toggle-sidebar-btn" 
              onClick={() => setIsSidebarVisible(!isSidebarVisible)}
              title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px', height: '32px', borderRadius: '10px' }}
            >
              <Menu size={16} />
            </button>
            <h2 
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={() => {
                const newName = prompt("Enter your profile name:", userName);
                if (newName && newName.trim()) {
                  const clean = newName.trim();
                  setUserName(clean);
                  localStorage.setItem('spoty_username', clean);
                  triggerNotification("Profile name updated!");
                }
              }}
              title="Click to edit profile name"
            >
              Good evening, {userName || 'User'}
            </h2>
          </div>
          
          <div className="bento-search-box">
            <Search className="search-icon text-muted" size={14} />
            <input 
              type="text" 
              placeholder="Search by title, artist, genre..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-action-row">
            <button className="header-icon-btn"><Bell size={16} /></button>
            <button 
              className={`header-icon-btn ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => navigateToView('settings')}
            >
              <Settings size={16} />
            </button>
          </div>
        </header>

        {/* Scrollable contents grid depending on Active View */}
        {selectedCategory ? (
          /* ==========================================================
             FOLDER DETAIL SUB-SCREEN VIEW
             ========================================================== */
          <section className="folder-detail-view animate-fade-in bento-panel">
            <div className="folder-detail-header">
              <div className="folder-meta-left">
                <span className="folder-lbl">FOLDER CATEGORY</span>
                <h2>{selectedCategory}</h2>
                <p>{songs.filter(s => s.album === selectedCategory).length} tracks offline</p>
              </div>
              
              <div className="folder-meta-right">
                <button className="btn-secondary" onClick={() => setSelectedCategory(null)}>
                  Go Back
                </button>
                <button className="btn-primary" onClick={() => {
                  const folderSongs = songs.filter(s => s.album === selectedCategory);
                  if (folderSongs.length > 0) handlePlaySong(folderSongs[0], folderSongs);
                }}>
                  <Play size={14} fill="currentColor" />
                  <span>Play All</span>
                </button>
                <button className="btn-secondary btn-delete-all" onClick={async () => {
                  if (confirm(`Delete folder "${selectedCategory}" and all its songs permanently?`)) {
                    const folderSongs = songs.filter(s => s.album === selectedCategory);
                    for (const s of folderSongs) {
                      await deleteSong(s.id);
                    }
                    await loadLocalData();
                    setSelectedCategory(null);
                    triggerNotification(`Folder "${selectedCategory}" deleted permanently.`);
                  }
                }}>
                  Delete Folder
                </button>
              </div>
            </div>

            <div className="folder-songs-list">
              {songs.filter(s => s.album === selectedCategory).map((song, idx) => (
                <div 
                  key={song.id} 
                  className={`folder-song-row ${currentTrack && currentTrack.id === song.id ? 'active' : ''}`}
                  onClick={() => handlePlaySong(song, songs.filter(s => s.album === selectedCategory))}
                >
                  <span className="song-idx">{idx + 1}</span>
                  <div className="song-row-info">
                    <span className="song-row-title truncate">{song.title}</span>
                    <span className="song-row-artist truncate">{song.artist}</span>
                  </div>
                  <span className="song-row-duration">{formatTime(song.duration)}</span>
                  <button 
                    className="song-row-del-btn" 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete song "${song.title}" from library?`)) {
                        await deleteSong(song.id);
                        await loadLocalData();
                        
                        const remaining = songs.filter(s => s.album === selectedCategory && s.id !== song.id);
                        if (remaining.length === 0) {
                          setSelectedCategory(null);
                        }
                        triggerNotification(`Song deleted.`);
                      }
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ) : activeView === 'equalizer' ? (
          /* ==========================================================
             EQUALIZER DSP VIEW PANEL
             ========================================================== */
          <section className="equalizer-view animate-fade-in bento-panel" style={{ padding: '24px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div>
                <span className="folder-lbl" style={{ color: 'var(--secondary)' }}>PREMIUM DSP ENGINE</span>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '4px', marginTop: '4px' }}>Cinematic Audio Processor</h2>
                <p style={{ color: 'var(--text-dark)', fontSize: '0.8rem' }}>Home theater quality bass, protected vocals, and distortion-free volume.</p>
              </div>
              <div style={{ width: '200px', height: '50px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)', background: '#150608' }}>
                <canvas ref={canvasRef} width={200} height={50} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              {/* BASS ENGINE */}
              <div className="bento-panel" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '4px' }}>Subwoofer & Bass Engine</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginBottom: '12px' }}>Dynamic low-shelf & harmonic punch generator</p>
                
                <div style={{ marginBottom: '12px' }}>
                  <select 
                    value={bassProfile} 
                    onChange={(e) => setBassProfile(e.target.value)}
                    style={{ width: '100%', padding: '8px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', outline: 'none', fontSize: '0.8rem' }}
                  >
                    {['Studio Bass', 'Home Theater', 'Car Bass', 'DJ Bass', 'Cinema Bass', 'Punjabi Bass', 'Workout Bass'].map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', width: '50px', color: 'var(--text-dark)' }}>Intensity</span>
                  <input type="range" min="0" max="100" value={subwooferLevel} onChange={(e) => setSubwooferLevel(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--accent)' }} />
                  <span style={{ fontWeight: 'bold', color: 'var(--accent)', fontSize: '0.8rem', width: '30px' }}>{subwooferLevel}%</span>
                </div>
              </div>

              {/* VOLUME BOOST */}
              <div className="bento-panel" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                <h4 style={{ marginBottom: '4px' }}>Volume & Clarity Engine</h4>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-dark)', marginBottom: '12px' }}>Limiter-protected boost & high-end presence</p>
                
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                  {[1.0, 1.25, 1.5, 1.75, 2.0].map(vol => (
                    <button 
                      key={vol} 
                      className={volumeBoost === vol ? 'btn-primary' : 'btn-secondary'} 
                      onClick={() => setVolumeBoost(vol)} 
                      style={{ flex: 1, padding: '6px 0', fontSize: '0.7rem', borderRadius: '8px', justifyContent: 'center' }}
                    >
                      {vol * 100}%
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.75rem', width: '50px', color: 'var(--text-dark)' }}>Clarity</span>
                  <input type="range" min="0" max="100" value={clarityLevel} onChange={(e) => setClarityLevel(parseInt(e.target.value))} style={{ flex: 1, accentColor: 'var(--secondary)' }} />
                  <span style={{ fontWeight: 'bold', color: 'var(--secondary)', fontSize: '0.8rem', width: '30px' }}>{clarityLevel}%</span>
                </div>
              </div>
            </div>

            <div className="bento-panel" style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ fontSize: '1rem', margin: 0 }}>10-Band EQ Tuning</h4>
                <button className="btn-secondary" onClick={handleResetEq} style={{ padding: '4px 10px', fontSize: '0.75rem', borderRadius: '8px' }}>Reset Flat</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', height: '140px', alignItems: 'flex-end', paddingBottom: '12px' }}>
                {['31', '62', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'].map((band, idx) => (
                  <div key={band} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '10%' }}>
                    <span style={{ fontSize: '0.65rem', color: eqGains[idx] !== 0 ? 'var(--primary)' : 'var(--text-dark)', marginBottom: '4px', fontWeight: 'bold' }}>
                      {eqGains[idx] > 0 ? '+' : ''}{eqGains[idx].toFixed(1)}
                    </span>
                    <input 
                      type="range" 
                      min="-12" max="12" step="0.1" 
                      value={eqGains[idx]}
                      onChange={(e) => handleEqChange(idx, parseFloat(e.target.value))}
                      style={{ 
                        writingMode: 'vertical-lr', direction: 'rtl', width: '6px', height: '80px',
                        accentColor: eqGains[idx] !== 0 ? 'var(--primary)' : 'var(--text-dark)'
                      }} 
                    />
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-dark)', marginTop: '8px', fontWeight: 'bold' }}>{band}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : activeView === 'cloud' ? (
          /* ==========================================================
             GLOBAL CLOUD PLAYLIST VIEW
             ========================================================== */
          <section className="home-viewport-scroll animate-fade-in">
            {!isCloudConfigured ? (
              // --- FORM: CONFIGURE SUPABASE ONLINE MODE ---
              <div className="bento-panel animate-slide-in" style={{ padding: '30px', maxWidth: '650px', margin: '20px auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--secondary) 0%, var(--accent) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto', color: 'white' }}>
                    <Globe size={28} />
                  </div>
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, marginBottom: '6px' }}>Configure Global Online Mode</h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                    Spoty is 100% serverless! You can configure your own private Supabase cloud project to upload and stream songs globally with friends. Enter your details below to activate.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Supabase Project URL</label>
                    <input 
                      type="text" 
                      value={sbUrl} 
                      onChange={(e) => setSbUrl(e.target.value.trim())}
                      placeholder="https://your-project.supabase.co"
                      style={{ padding: '10px 14px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>

                  <div className="input-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>Supabase Anonymous Key (Anon API Key)</label>
                    <input 
                      type="password" 
                      value={sbAnonKey} 
                      onChange={(e) => setSbAnonKey(e.target.value.trim())}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      style={{ padding: '10px 14px', background: 'var(--bg-primary)', color: 'white', border: '1px solid var(--glass-border)', borderRadius: '10px', fontSize: '0.8rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <button 
                  className="btn-primary"
                  onClick={() => {
                    if (!sbUrl || !sbAnonKey) {
                      alert("Please fill in both the Supabase URL and Anonymous Key to connect!");
                      return;
                    }
                    localStorage.removeItem('spoty_supabase_disconnected');
                    localStorage.setItem('spoty_supabase_url', sbUrl);
                    localStorage.setItem('spoty_supabase_anon_key', sbAnonKey);
                    
                    setIsCloudConfigured(true);
                    triggerNotification("Supabase Online Mode connected! 🎉");
                  }}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <Globe size={18} />
                  <span>Connect & Activate Online Cloud</span>
                </button>
              </div>
            ) : (
              // --- LIVE ONLINE CLOUD DASHBOARD ---
              <div className="home-section-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <span className="home-sec-title">Global Cloud Library</span>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                      Streaming dynamically shared audio files uploaded by users globally via Supabase.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn-secondary"
                      onClick={loadCloudData}
                      disabled={isLoadingCloud}
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      {isLoadingCloud ? 'Refreshing...' : '🔄 Refresh Shared'}
                    </button>
                    <button 
                      className="btn-danger-outline"
                      onClick={() => {
                        if (confirm("Disconnect from cloud database and clear keys?")) {
                          localStorage.setItem('spoty_supabase_disconnected', 'true');
                          localStorage.removeItem('spoty_supabase_url');
                          localStorage.removeItem('spoty_supabase_anon_key');
                          
                          setSbUrl('');
                          setSbAnonKey('');
                          
                          setIsCloudConfigured(false);
                          setCloudSongs([]);
                          triggerNotification("Cloud disconnected.");
                        }
                      }}
                      style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    >
                      Disconnect Cloud
                    </button>
                  </div>
                </div>

                {/* DYNAMIC STORAGE CAPACITY BAR */}
                <div className="bento-panel animate-fade-in" style={{ 
                  padding: '14px 20px', 
                  marginBottom: '16px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  gap: '20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>☁️ Cloud Storage Capacity</span>
                      {cloudSongs.length >= 45 && (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          padding: '2px 8px', 
                          background: cloudSongs.length >= 50 ? 'rgba(255, 75, 75, 0.1)' : 'rgba(255, 165, 0, 0.1)', 
                          color: cloudSongs.length >= 50 ? '#ff4b4b' : '#ffa500', 
                          borderRadius: '20px', 
                          fontWeight: 700 
                        }}>
                          {cloudSongs.length >= 50 ? '🚨 FULL' : '⚠️ ALMOST FULL'}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Using {cloudSongs.length} of 50 slots • <strong>{Math.max(0, 50 - cloudSongs.length)} slots left</strong>
                    </span>
                  </div>

                  <div style={{ flex: '1', minWidth: '150px', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ width: '100%', height: '8px', background: 'var(--bg-primary)', borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                      <div style={{ 
                        width: `${Math.min(100, (cloudSongs.length / 50) * 100)}%`, 
                        height: '100%', 
                        background: cloudSongs.length >= 50 ? 'linear-gradient(90deg, #ff4b4b, #ff7b7b)' : 'linear-gradient(90deg, var(--secondary), var(--accent))',
                        borderRadius: '10px',
                        transition: 'width 0.5s ease-in-out'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      <span>{Math.round(cloudSongs.length * 8)} MB Est. Used</span>
                      <span><strong>{Math.max(0, 400 - Math.round(cloudSongs.length * 8))} MB Remaining</strong> (of 400MB safety limit)</span>
                    </div>
                  </div>
                </div>

                {isLoadingCloud ? (
                  <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 600 }}>Syncing with Supabase...</span>
                  </div>
                ) : cloudSongs.length > 0 ? (
                  <div className="bento-panel" style={{ padding: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-dark)', height: '36px' }}>
                          <th style={{ paddingLeft: '12px' }}># Title</th>
                          <th>Album</th>
                          <th>Genre</th>
                          <th>Uploader</th>
                          <th style={{ textAlign: 'right', paddingRight: '12px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cloudSongs.map((song, idx) => {
                          const isCurrent = currentTrack && currentTrack.id === song.id;
                          const grad = generateCoverGradient(song.title);
                          return (
                            <tr 
                              key={song.id} 
                              className={`song-table-row ${isCurrent ? 'active' : ''}`}
                              style={{ 
                                height: '56px', 
                                borderBottom: '1px solid rgba(255,255,255,0.01)',
                                transition: 'var(--transition-smooth)',
                                borderRadius: '12px'
                              }}
                            >
                              <td style={{ paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '10px', height: '56px' }}>
                                <div style={{ position: 'relative', width: '38px', height: '38px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0 }}>
                                  {song.coverUrl ? (
                                    <img src={song.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}>
                                      {song.title.substring(0, 2).toUpperCase()}
                                    </div>
                                  )}
                                  <button 
                                    onClick={() => handlePlaySong(song, cloudSongs)}
                                    style={{ 
                                      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                                      background: 'rgba(0,0,0,0.6)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                      opacity: isCurrent ? 1 : 0, transition: 'var(--transition-smooth)', cursor: 'pointer' 
                                    }}
                                    className="cloud-play-hover-btn"
                                  >
                                    {isCurrent && isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                                  </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--text-main)' }} className="truncate">{song.title}</span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }} className="truncate">{song.artist}</span>
                                </div>
                              </td>
                              <td style={{ color: 'var(--text-muted)' }} className="truncate">{song.album}</td>
                              <td>
                                <span style={{ padding: '2px 8px', background: 'var(--bg-primary)', borderRadius: '6px', fontSize: '0.65rem', color: 'var(--secondary)' }}>
                                  {song.genre}
                                </span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>👤 {song.uploader}</td>
                              <td style={{ textAlign: 'right', paddingRight: '12px' }}>
                                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                    <button 
                                      onClick={() => handleLikeCloudSong(song.id)}
                                      style={{ background: 'none', border: 'none', color: 'var(--secondary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                      title="Like globally"
                                    >
                                      <Heart size={14} fill={song.likes > 0 ? "currentColor" : "none"} />
                                      <span>{song.likes || 0}</span>
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteCloudSong(song.id, song.title)}
                                      style={{ background: 'none', border: 'none', color: 'rgba(255,100,100,0.8)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                      title="Delete from Cloud"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="bento-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Globe size={36} style={{ marginBottom: '8px', color: 'var(--text-dark)' }} />
                    <h4>Cloud Library is Empty</h4>
                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Click the "Upload MP3" button in sidebar and check the "Share with the world" toggle to upload the first track!</p>
                  </div>
                )}
              </div>
            )}
          </section>
        ) : activeView === 'folders' ? (
          /* ==========================================================
             FOLDERS COLLAGE GRID VIEW
             ========================================================== */
          <section className="home-viewport-scroll animate-fade-in">
            <div className="home-section-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="home-sec-title">Smart Folder Categories</span>
                <button className="btn-primary" onClick={() => setIsUploadOpen(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                  <FolderPlus size={14} /> Import Folder
                </button>
              </div>
              <div className="folders-collage-grid">
                {categories.map((cat) => (
                  <div 
                    key={cat.name} 
                    className="folder-collage-card"
                    onClick={() => setSelectedCategory(cat.name)}
                  >
                    <FolderCollage folderName={cat.name} songs={songs} />
                    <div className="folder-card-meta">
                      <h4 className="truncate">{cat.name}</h4>
                      <p>{cat.count} offline tracks</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : activeView === 'playlists' ? (
          /* ==========================================================
             PLAYLISTS GRID VIEW
             ========================================================== */
          <section className="home-viewport-scroll animate-fade-in">
            <div className="home-section-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="home-sec-title">Custom Playlists</span>
                <button 
                  className="btn-primary" 
                  onClick={() => {
                    const name = prompt("Enter new Playlist name:");
                    if (name && name.trim()) handleCreatePlaylist(name.trim());
                  }}
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                >
                  <Plus size={14} /> Create Playlist
                </button>
              </div>

              {activePlaylistId && playlists.find(p => p.id === activePlaylistId) ? (
                // Detailed view of selected playlist
                (() => {
                  const pl = playlists.find(p => p.id === activePlaylistId);
                  const plSongs = (pl.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
                  
                  return (
                    <div className="bento-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h3 style={{ fontSize: '1.25rem' }}>{pl.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{plSongs.length} songs saved</p>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-secondary" onClick={() => setActivePlaylistId(null)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            Go Back
                          </button>
                          <button className="btn-primary" onClick={() => {
                            if (plSongs.length > 0) handlePlaySong(plSongs[0], plSongs);
                          }} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                            <Play size={14} fill="currentColor" /> Play Queue
                          </button>
                          <button className="btn-secondary" onClick={async () => {
                            if (confirm(`Delete playlist "${pl.name}" permanently?`)) {
                              await deletePlaylist(pl.id);
                              setActivePlaylistId(null);
                              await loadLocalData();
                              triggerNotification('Playlist deleted.');
                            }
                          }} style={{ color: '#ef4444' }}>
                            Delete Playlist
                          </button>
                        </div>
                      </div>

                      <div className="folder-songs-list">
                        {plSongs.map((song, i) => (
                          <div 
                            key={song.id}
                            className="folder-song-row"
                            onClick={() => handlePlaySong(song, plSongs)}
                          >
                            <span className="song-idx">{i + 1}</span>
                            <div className="song-row-info">
                              <span className="song-row-title truncate">{song.title}</span>
                              <span className="song-row-artist truncate">{song.artist}</span>
                            </div>
                            <button 
                              className="song-row-del-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddSongToPlaylist(song.id, pl.id);
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="folders-collage-grid">
                  {playlists.map((pl) => {
                    const plSongs = (pl.songIds || []).map(id => songs.find(s => s.id === id)).filter(Boolean);
                    const grad = generateCoverGradient(pl.name);
                    
                    return (
                      <div 
                        key={pl.id} 
                        className="folder-collage-card"
                        onClick={() => setActivePlaylistId(pl.id)}
                      >
                        <div className="folder-collage" style={{ background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ListMusic size={32} className="text-white" />
                        </div>
                        <div className="folder-card-meta">
                          <h4 className="truncate">{pl.name}</h4>
                          <p>{plSongs.length} tracks</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        ) : activeView === 'settings' ? (
          /* ==========================================================
             SETTINGS PANEL VIEW
             ========================================================== */
          <section className="equalizer-view animate-fade-in bento-panel" style={{ padding: '24px', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Application Configuration</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '20px' }}>Spoty is a 100% offline-first, local cached bento music player.</p>

            {/* Profile Settings */}
            <div className="bento-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Profile Configuration</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                <input 
                  type="text" 
                  value={userName} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setUserName(val);
                    localStorage.setItem('spoty_username', val);
                  }}
                  placeholder="Enter your name..."
                  style={{ 
                    padding: '8px 12px', 
                    background: 'var(--bg-primary)', 
                    color: 'white', 
                    border: '1px solid var(--glass-border)', 
                    borderRadius: '10px', 
                    outline: 'none',
                    fontSize: '0.85rem',
                    flex: 1
                  }}
                />
                <button 
                  className="btn-secondary" 
                  onClick={() => {
                    const newName = prompt("Enter your new profile name:", userName);
                    if (newName && newName.trim()) {
                      const clean = newName.trim();
                      setUserName(clean);
                      localStorage.setItem('spoty_username', clean);
                      triggerNotification("Profile name updated!");
                    }
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.8rem', borderRadius: '10px', height: '36px' }}
                >
                  Change Name
                </button>
              </div>
            </div>

            {/* Theme Settings */}
            <div className="bento-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Accent & Color Theme</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Personalize the accent colors and dynamic ambient lighting of your interface.</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                {[
                  { id: 'terracotta', name: 'Terracotta Rose', color1: '#8e2e3e', color2: '#f3735d', desc: 'Warm Peach & Crimson' },
                  { id: 'black', name: 'Carbon Black', color1: '#121212', color2: '#00e5ff', desc: 'Cyber Neon Electric' },
                  { id: 'white', name: 'Frost White', color1: '#ffffff', color2: '#4f46e5', desc: 'Frosted Glass Light' },
                  { id: 'green', name: 'Forest Green', color1: '#081a14', color2: '#10b981', desc: 'Moss & Emerald Jade' },
                  { id: 'orange', name: 'Cyber Orange', color1: '#19120c', color2: '#f97316', desc: 'Warm Honey Amber' },
                ].map((t) => {
                  const isSelected = activeTheme === t.id;
                  return (
                    <div 
                      key={t.id}
                      onClick={() => {
                        setActiveTheme(t.id);
                        localStorage.setItem('spoty_color_theme', t.id);
                        triggerNotification(`Theme switched to ${t.name}!`);
                      }}
                      className={`compact-song-card ${isSelected ? 'active-bg-card' : ''}`}
                      style={{ 
                        padding: '12px', 
                        cursor: 'pointer', 
                        position: 'relative',
                        border: isSelected ? '1px solid var(--secondary)' : '1px solid transparent',
                        borderRadius: '16px',
                        background: 'var(--bg-primary)',
                        transition: 'var(--transition-smooth)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}
                    >
                      <div style={{ 
                        height: '42px', 
                        borderRadius: '8px', 
                        background: `linear-gradient(135deg, ${t.color1} 0%, ${t.color2} 100%)`,
                        border: '1px solid var(--glass-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        padding: '6px'
                      }}>
                        {isSelected && <span style={{ fontSize: '0.65rem', background: 'rgba(0,0,0,0.65)', padding: '2px 6px', borderRadius: '6px', color: 'white', fontWeight: 600 }}>ACTIVE</span>}
                      </div>
                      <div>
                        <h5 style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>{t.name}</h5>
                        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Background Video Customizer */}
            <div className="bento-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '4px' }}>Cinematic Background Customizer</h4>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Select a default cinematic atmosphere, cycle them, or upload your own MP4 video background.</p>
                </div>
                
                {/* Playback Mode Toggles */}
                <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '12px', border: '1px solid var(--glass-border)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    className={`filter-btn-pill ${bgMode === 'rotate' ? 'active' : ''}`}
                    onClick={() => {
                      setBgMode('rotate');
                      localStorage.setItem('spoty_bg_mode', 'rotate');
                      triggerNotification("Auto-rotation enabled!");
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '8px' }}
                  >
                    🔄 Auto-Rotate ({bgRotateTime >= 60 ? `${bgRotateTime / 60}m` : `${bgRotateTime}s`})
                  </button>
                  
                  {bgMode === 'rotate' && (
                    <select
                      value={bgRotateTime}
                      onChange={(e) => {
                        const secs = parseInt(e.target.value, 10);
                        setBgRotateTime(secs);
                        localStorage.setItem('spoty_bg_rotate_time', secs.toString());
                        triggerNotification(`Interval set to ${secs >= 60 ? `${secs/60}m` : `${secs}s`}`);
                      }}
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'white',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        padding: '4px 6px',
                        fontSize: '0.72rem',
                        outline: 'none',
                        cursor: 'pointer',
                        marginRight: '2px',
                        height: '26px'
                      }}
                      title="Set rotation speed"
                    >
                      <option value="10">10s</option>
                      <option value="30">30s</option>
                      <option value="60">1m</option>
                      <option value="300">5m</option>
                      <option value="600">10m</option>
                    </select>
                  )}

                  <button 
                    className={`filter-btn-pill ${bgMode === 'static' ? 'active' : ''}`}
                    onClick={() => {
                      setBgMode('static');
                      localStorage.setItem('spoty_bg_mode', 'static');
                      triggerNotification("Locked active background!");
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '8px' }}
                  >
                    🔒 Static Lock
                  </button>

                  <button 
                    className={`filter-btn-pill ${bgMode === 'disabled' ? 'active' : ''}`}
                    onClick={() => {
                      setBgMode('disabled');
                      localStorage.setItem('spoty_bg_mode', 'disabled');
                      triggerNotification("Video background disabled.");
                    }}
                    style={{ padding: '6px 12px', fontSize: '0.72rem', borderRadius: '8px' }}
                  >
                    🚫 Disable Video
                  </button>
                </div>
              </div>

              {/* Background Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '12px', marginTop: '4px' }}>
                {/* Default Background Cards */}
                {visibleDefaultBgs.map((bg) => {
                  const isActive = activeBgId === bg.id && bgMode === 'static';
                  return (
                    <div 
                      key={bg.id}
                      onClick={() => handleSelectBackground(bg.id)}
                      className={`compact-song-card ${isActive ? 'active-bg-card' : ''}`}
                      style={{ 
                        padding: '10px', 
                        cursor: 'pointer', 
                        position: 'relative',
                        border: isActive ? '1px solid var(--secondary)' : '1px solid transparent',
                        borderRadius: '16px',
                        background: 'var(--bg-primary)',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <div style={{ height: '70px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--bg-tertiary) 0%, var(--primary) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center', padding: '6px' }}>
                        {bg.name}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Default</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isActive && <span style={{ fontSize: '0.7rem' }}>✅</span>}
                          <button 
                            onClick={(e) => handleDeleteDefaultBackground(bg.id, e)}
                            style={{ background: 'none', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}
                            title="Remove this default background"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Restore All Defaults Button (shown only when some are hidden) */}
                {hiddenDefaultBgs.length > 0 && (
                  <div 
                    onClick={handleRestoreAllDefaultBackgrounds}
                    className="compact-song-card"
                    style={{ 
                      padding: '10px', 
                      cursor: 'pointer', 
                      position: 'relative',
                      border: '1px dashed var(--secondary)',
                      borderRadius: '16px',
                      background: 'rgba(255,255,255,0.02)',
                      transition: 'var(--transition-smooth)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <span style={{ fontSize: '1.2rem' }}>🔄</span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--secondary)', fontWeight: 600, textAlign: 'center' }}>Restore {hiddenDefaultBgs.length} Hidden</span>
                  </div>
                )}

                {/* Custom Background Cards */}
                {customBackgrounds.map((bg) => {
                  const isActive = activeBgId === bg.id && bgMode === 'static';
                  return (
                    <div 
                      key={bg.id}
                      onClick={() => handleSelectBackground(bg.id)}
                      className={`compact-song-card ${isActive ? 'active-bg-card' : ''}`}
                      style={{ 
                        padding: '10px', 
                        cursor: 'pointer', 
                        position: 'relative',
                        border: isActive ? '1px solid var(--secondary)' : '1px solid transparent',
                        borderRadius: '16px',
                        background: 'var(--bg-primary)',
                        transition: 'var(--transition-smooth)'
                      }}
                    >
                      <div style={{ height: '70px', borderRadius: '10px', background: 'linear-gradient(135deg, var(--secondary-glow) 0%, var(--accent) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', textAlign: 'center', padding: '6px' }}>
                        {bg.name}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--secondary)' }}>Custom</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isActive && <span style={{ fontSize: '0.7rem' }}>✅</span>}
                          <button 
                            onClick={(e) => handleDeleteBackground(bg.id, e)}
                            style={{ background: 'none', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: '0.8rem', padding: '2px' }}
                            title="Delete custom background"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Upload Button Card */}
                <label 
                  style={{ 
                    height: '110px', 
                    borderRadius: '16px', 
                    border: '1px dashed var(--text-dark)', 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    gap: '8px',
                    transition: 'var(--transition-smooth)',
                    background: 'rgba(255,255,255,0.02)'
                  }}
                  className="upload-bg-card-label"
                >
                  <Plus size={20} className="text-muted" />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>Upload Image or MP4</span>
                  <input 
                    type="file" 
                    accept="image/*,video/mp4" 
                    onChange={handleUploadBackground} 
                    style={{ display: 'none' }} 
                  />
                </label>
              </div>
            </div>

            <div className="bento-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Local Library Statistics</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '4px' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>CRAWLED TRACKS</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--secondary)', marginTop: '4px' }}>{songs.length}</h3>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>FOLDERS SCANNED</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--accent)', marginTop: '4px' }}>{categories.length}</h3>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700 }}>LISTENING HOURS</span>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--primary)', marginTop: '4px' }}>{listeningHours}h</h3>
                </div>
              </div>
            </div>

            {/* DUAL COLUMN INTERACTIVE LIBRARY MANAGER */}
            <div className="settings-manager-grid">
              {/* LEFT PANEL: FOLDER MANAGEMENT */}
              <div className="settings-manager-panel bento-panel">
                <div className="settings-manager-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      className="settings-checkbox"
                      checked={categories.length > 0 && selectedFolderNames.length === categories.length}
                      onChange={handleSelectAllFolders}
                    />
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Folders ({categories.length})</span>
                  </div>
                  {selectedFolderNames.length > 0 && (
                    <button 
                      className="btn-delete-selected"
                      onClick={handleDeleteSelectedFolders}
                    >
                      Delete Selected ({selectedFolderNames.length})
                    </button>
                  )}
                </div>

                <div className="settings-list-scroll">
                  {categories.length > 0 ? (
                    categories.map((cat) => {
                      const isFolderSelected = selectedFolderNames.includes(cat.name);
                      return (
                        <div 
                          key={cat.name} 
                          className={`settings-list-item ${isFolderSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleFolderSelect(cat.name)}
                        >
                          <input 
                            type="checkbox" 
                            className="settings-checkbox"
                            checked={isFolderSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleFolderSelect(cat.name);
                            }}
                          />
                          <div className="settings-item-info">
                            <span className="settings-item-title truncate">{cat.name}</span>
                            <span className="settings-item-sub">{cat.count} tracks</span>
                          </div>
                          <button 
                            className="settings-item-del-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleFolder(cat.name);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                      No folders scanned.
                    </div>
                  )}
                </div>

                <div className="settings-manager-footer">
                  <button 
                    className="btn-danger-outline" 
                    onClick={handleDeleteAllFolders}
                    disabled={categories.length === 0}
                  >
                    Delete All Folders
                  </button>
                </div>
              </div>

              {/* RIGHT PANEL: SONG MANAGEMENT */}
              <div className="settings-manager-panel bento-panel">
                <div className="settings-manager-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="checkbox" 
                      className="settings-checkbox"
                      checked={songs.length > 0 && selectedSongIds.length === songs.length}
                      onChange={handleSelectAllSongs}
                    />
                    <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Songs ({songs.length})</span>
                  </div>
                  {selectedSongIds.length > 0 && (
                    <button 
                      className="btn-delete-selected"
                      onClick={handleDeleteSelectedSongs}
                    >
                      Delete Selected ({selectedSongIds.length})
                    </button>
                  )}
                </div>

                {/* Search input for large library optimization */}
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0,0,0,0.05)' }}>
                  <input 
                    type="text"
                    value={songManagerSearch}
                    onChange={(e) => {
                      setSongManagerSearch(e.target.value);
                      setSongManagerLimit(50); // Reset limit when searching
                    }}
                    placeholder="Search songs to manage..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      outline: 'none',
                      fontSize: '0.75rem'
                    }}
                  />
                </div>

                <div className="settings-list-scroll">
                  {displayedManagerSongs.length > 0 ? (
                    displayedManagerSongs.map((song) => {
                      const isSongSelected = selectedSongIds.includes(song.id);
                      return (
                        <div 
                          key={song.id} 
                          className={`settings-list-item ${isSongSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleSongSelect(song.id)}
                        >
                          <input 
                            type="checkbox" 
                            className="settings-checkbox"
                            checked={isSongSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSongSelect(song.id);
                            }}
                          />
                          <div className="settings-item-info">
                            <span className="settings-item-title truncate">{song.title}</span>
                            <span className="settings-item-sub truncate">{song.artist} | {song.album || 'Music Folder'}</span>
                          </div>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginRight: '6px', whiteSpace: 'nowrap' }}>
                            {formatTime(song.duration)}
                          </span>
                          <button 
                            className="settings-item-del-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSong(song.id, song.title);
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dark)', fontSize: '0.75rem' }}>
                      {songs.length > 0 ? "No matching songs found." : "No songs in library."}
                    </div>
                  )}

                  {filteredManagerSongs.length > songManagerLimit && (
                    <div 
                      onClick={() => setSongManagerLimit(prev => prev + 100)}
                      style={{
                        padding: '12px',
                        textAlign: 'center',
                        color: 'var(--secondary)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        background: 'rgba(255,255,255,0.02)',
                        borderTop: '1px solid var(--glass-border)',
                        transition: 'var(--transition-smooth)',
                        userSelect: 'none'
                      }}
                      className="load-more-songs-row"
                    >
                      Show More Songs (+{filteredManagerSongs.length - songManagerLimit})
                    </div>
                  )}
                </div>

                <div className="settings-manager-footer">
                  <button 
                    className="btn-danger-outline" 
                    onClick={handleDeleteAllFolders}
                    disabled={songs.length === 0}
                  >
                    Delete All Songs
                  </button>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button className="btn-primary" onClick={() => setIsUploadOpen(true)}>
                <FolderPlus size={16} /> Import New Music Folder
              </button>
              <button 
                className="btn-secondary" 
                onClick={async () => {
                  if (confirm("Reset local database and clear all songs/playlists?")) {
                    clearCoverCaches();
                    for (const s of songs) {
                      await deleteSong(s.id);
                    }
                    for (const p of playlists) {
                      await deletePlaylist(p.id);
                    }
                    localStorage.clear();
                    await loadLocalData();
                    triggerNotification("Database successfully wiped.");
                  }
                }}
                style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
              >
                Clear Database cache
              </button>
            </div>
          </section>
        ) : activeView === 'library' ? (
          /* ==========================================================
             LIKED SONGS VIEW: Focused Grid of Liked Songs
             ========================================================== */
          <section className="home-viewport-scroll animate-fade-in">
            <div className="home-section-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="home-sec-title" style={{ margin: 0 }}>Liked Songs</span>
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      if (librarySongs.length > 0) {
                        const shuffled = [...librarySongs].sort(() => Math.random() - 0.5);
                        handlePlaySong(shuffled[0], shuffled);
                        setIsShuffle(true);
                        triggerNotification("Playing liked songs in random shuffle!");
                      } else {
                        triggerNotification("No liked songs to play!", "error");
                      }
                    }} 
                    style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                    title="Shuffle Play Liked Songs"
                  >
                    <Shuffle size={12} />
                    <span>Shuffle Play</span>
                  </button>
                  {librarySongs.length > 0 && (
                    <button 
                      className="btn-secondary" 
                      onClick={handleClearAllLikes}
                      style={{ padding: '4px 10px', fontSize: '0.7rem', borderRadius: '8px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                    >
                      Clear All Likes
                    </button>
                  )}
                </div>
                
                {/* Quick Sort Options */}
                <div className="header-action-row">
                  {['Recently Added', 'Artists', 'Albums'].map((sortType) => (
                    <button 
                      key={sortType}
                      className={`filter-btn-pill ${currentSort === sortType ? 'active' : ''}`}
                      onClick={() => setCurrentSort(sortType)}
                    >
                      {sortType}
                    </button>
                  ))}
                </div>
              </div>

              {librarySongs.length > 0 ? (
                <div className="songs-compact-grid">
                  {librarySongs.map((song) => (
                    <div 
                      key={song.id} 
                      className="compact-song-card"
                      onClick={() => handlePlaySong(song, librarySongs)}
                    >
                      <div className="card-artwork-box">
                        <TrackCover track={song} className="folder-collage-full" />
                        
                        <div className="card-hover-overlay">
                          <button 
                            className="card-overlay-btn play"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySong(song, librarySongs);
                            }}
                            title="Play Song"
                          >
                            <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
                          </button>
                          
                          <button 
                            className="card-overlay-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSong(song.id, song.title);
                            }}
                            title="Delete Song"
                            style={{
                              marginLeft: '8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.15)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="card-details-box">
                        <span className="card-title truncate" title={song.title}>{song.title}</span>
                        <span className="card-artist truncate">{song.artist}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bento-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dark)' }}>
                  No liked songs in your library yet. Click the heart icon on any song on the Home page to add them here!
                </div>
              )}
            </div>
          </section>
        ) : activeView === 'favorites' ? (
          /* ==========================================================
             LIKED SONGS VIEW: Dedicated premium playlist view
             ========================================================== */
          <section className="folder-detail-view animate-fade-in bento-panel">
            <div className="folder-detail-header" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--bg-secondary) 100%)', padding: '24px', borderRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="folder-meta-left">
                <span className="folder-lbl" style={{ color: 'var(--secondary)' }}>OFFLINE COLLECTION</span>
                <h2 style={{ fontSize: '1.75rem', marginTop: '4px', marginBottom: '4px' }}>Liked Songs</h2>
                <p>{likedSongsList.length} favorite tracks</p>
              </div>
              
              <div className="folder-meta-right" style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-primary" onClick={() => {
                  if (likedSongsList.length > 0) handlePlaySong(likedSongsList[0], likedSongsList);
                }} disabled={likedSongsList.length === 0}>
                  <Play size={14} fill="currentColor" />
                  <span>Play Favorites</span>
                </button>
                <button className="btn-secondary" onClick={() => {
                  if (likedSongsList.length > 0) {
                    const shuffled = [...likedSongsList].sort(() => Math.random() - 0.5);
                    handlePlaySong(shuffled[0], shuffled);
                    setIsShuffle(true);
                  }
                }} disabled={likedSongsList.length === 0}>
                  <Shuffle size={14} />
                  <span>Shuffle</span>
                </button>
              </div>
            </div>

            <div className="folder-songs-list" style={{ marginTop: '20px' }}>
              {likedSongsList.length > 0 ? (
                likedSongsList.map((song, idx) => (
                  <div 
                    key={'liked-row-' + song.id} 
                    className="folder-song-row"
                    onClick={() => handlePlaySong(song, likedSongsList)}
                  >
                    <span className="song-idx">{idx + 1}</span>
                    <div className="song-row-info">
                      <span className="song-row-title truncate">{song.title}</span>
                      <span className="song-row-artist truncate">{song.artist} | {song.album || 'Single'}</span>
                    </div>
                    <span className="song-row-duration">{formatTime(song.duration)}</span>
                    <button 
                      className="song-row-del-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(song);
                      }}
                      title="Remove from Liked Songs"
                      style={{ color: 'var(--secondary)', opacity: 1 }}
                    >
                      <Heart size={12} fill="var(--secondary)" color="var(--secondary)" />
                    </button>
                  </div>
                ))
              ) : (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-dark)' }}>
                  You haven't liked any songs yet. Click the heart icon on any track to add it here!
                </div>
              )}
            </div>
          </section>
        ) : (
          /* ==========================================================================
             DASHBOARD HOME VIEW (Spotify / Apple Music Grid-focused facelift)
             ========================================================================== */
          <section className="home-viewport-scroll animate-fade-in">
            
            {/* SECTION 2: Recently Played */}
            {recentlyPlayed.length > 0 && (
              <div className="home-section-container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span className="home-sec-title" style={{ margin: 0 }}>Recently Played</span>
                  <button 
                    className="btn-secondary" 
                    onClick={handleClearRecentlyPlayed}
                    style={{ padding: '4px 10px', fontSize: '0.65rem', borderRadius: '8px', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                  >
                    Clear Recent
                  </button>
                </div>
                <div className="horizontal-scroll-row">
                  {recentlyPlayed.map((song) => (
                    <div 
                      key={'recent-' + song.id}
                      className="compact-song-card"
                      onClick={() => handlePlaySong(song, recentlyPlayed)}
                    >
                      <div className="card-artwork-box">
                        <TrackCover track={song} className="folder-collage-full" />
                        <div className="card-hover-overlay">
                          <button 
                            className="card-overlay-btn play"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySong(song, recentlyPlayed);
                            }}
                            title="Play Song"
                          >
                            <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
                          </button>
                          
                          <button 
                            className="card-overlay-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSong(song.id, song.title);
                            }}
                            title="Delete Song"
                            style={{
                              marginLeft: '8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.15)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="card-details-box">
                        <span className="card-title truncate" title={song.title}>{song.title}</span>
                        <span className="card-artist truncate">{song.artist}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 4: Categories Horizontal filter Chips */}
            <div className="home-section-container" style={{ gap: '0.5rem' }}>
              <span className="home-sec-title">Quick Genre Filters</span>
              <div className="category-chips-row">
                {genreChips.map((chip) => (
                  <button 
                    key={chip} 
                    className={`genre-chip ${selectedGenreChip === chip ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedGenreChip(chip);
                      navigateToView('home'); // resets to home grid
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION 5: All Songs Grid */}
            <div className="home-section-container">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="home-sec-title" style={{ margin: 0 }}>
                    {selectedGenreChip === 'All' ? 'All Songs Grid' : `${selectedGenreChip} Music`}
                  </span>
                  <button 
                    className="btn-primary" 
                    onClick={handlePlayRandom} 
                    style={{ padding: '4px 10px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '6px', borderRadius: '8px' }}
                    title="Shuffle Play All Songs"
                  >
                    <Shuffle size={12} />
                    <span>Shuffle Play</span>
                  </button>
                </div>
                
                {/* Quick Sort Options */}
                <div className="header-action-row">
                  {['Recently Added', 'Artists', 'Albums'].map((sortType) => (
                    <button 
                      key={sortType}
                      className={`filter-btn-pill ${currentSort === sortType ? 'active' : ''}`}
                      onClick={() => setCurrentSort(sortType)}
                    >
                      {sortType}
                    </button>
                  ))}
                </div>
              </div>

              {displaySongs.length > 0 ? (
                <div className="songs-compact-grid">
                  {displaySongs.map((song) => (
                    <div 
                      key={song.id} 
                      className="compact-song-card"
                      onClick={() => handlePlaySong(song, displaySongs)}
                    >
                      <div className="card-artwork-box">
                        <TrackCover track={song} className="folder-collage-full" />
                        
                        {/* Artwork Hover Actions overlay */}
                        <div className="card-hover-overlay">
                          <button 
                            className="card-overlay-btn play"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlaySong(song, displaySongs);
                            }}
                            title="Play Song"
                          >
                            <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />
                          </button>
                          
                          <button 
                            className="card-overlay-btn delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSingleSong(song.id, song.title);
                            }}
                            title="Delete Song"
                            style={{
                              marginLeft: '8px',
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#ef4444',
                              borderRadius: '50%',
                              width: '36px',
                              height: '36px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.transform = 'scale(1.15)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.35)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      <div className="card-details-box">
                        <span className="card-title truncate" title={song.title}>{song.title}</span>
                        <span className="card-artist truncate">{song.artist}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bento-panel" style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dark)' }}>
                  No songs match the selected filters or query. Import more folders of music to get started!
                </div>
              )}
            </div>

          </section>
        )}
      </main>

      {/* ==========================================================================
         FOOTER: Compact Spotify-like bottom player bar
         ========================================================================== */}
      {currentTrack && (
        <footer className="crimson-audio-deck animate-slide-in">
          {/* Left section: Track Info */}
          <div className="deck-track-info">
            <div className="deck-cover">
              <TrackCover track={currentTrack} className="folder-collage-full" />
            </div>
            <div className="deck-track-details">
              <span className="deck-track-title truncate" title={currentTrack.title}>{currentTrack.title}</span>
              <span className="deck-track-artist truncate">{currentTrack.artist}</span>
            </div>
            <button 
              className="deck-like-btn"
              onClick={() => handleToggleFavorite(currentTrack)}
              style={{
                marginLeft: '12px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentTrack.isFavorite ? 'var(--secondary)' : 'var(--text-muted)',
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              title={currentTrack.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Heart 
                size={14} 
                fill={currentTrack.isFavorite ? 'var(--secondary)' : 'none'} 
                style={{ filter: currentTrack.isFavorite ? 'drop-shadow(0 0 4px var(--secondary-glow))' : 'none' }}
              />
            </button>
          </div>

          {/* Middle section: Compact media slider controls */}
          <div className="deck-player-controller">
            <div className="deck-buttons-row">
              <button className="deck-btn" onClick={() => setIsShuffle(!isShuffle)}>
                <Shuffle size={13} className={isShuffle ? 'active' : ''} />
              </button>
              <button className="deck-btn" onClick={handlePrev}><SkipBack size={15} fill="currentColor" /></button>
              <button className="deck-play-btn" onClick={() => setIsPlaying(!isPlaying)}>
                {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: '1.5px' }} />}
              </button>
              <button className="deck-btn" onClick={handleNext}><SkipForward size={15} fill="currentColor" /></button>
              <button className="deck-btn" onClick={() => setIsLooping(!isLooping)}>
                <Repeat size={13} className={isLooping ? 'active' : ''} />
              </button>
            </div>

            <div className="deck-seeker-row">
              <span className="deck-time-lbl">{formatTime(currentTime)}</span>
              <input 
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={handleSeek}
                className="deck-seeker-slider"
              />
              <span className="deck-time-lbl">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right section: Vol + Visualiser link */}
          <div className="deck-action-deck">
            <button 
              className={`deck-btn ${activeView === 'equalizer' ? 'active' : ''}`}
              onClick={() => navigateToView('equalizer')}
              title="Studio DSP Equalizer"
              style={{ marginRight: '6px' }}
            >
              <Sliders size={13} />
            </button>
            <button className="deck-btn" onClick={() => setIsMuted(!isMuted)}>
              {isMuted || volume === 0 ? <VolumeX size={15} /> : volume < 0.3 ? <Volume1 size={15} /> : <Volume2 size={15} />}
            </button>
            <input 
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value));
                setIsMuted(false);
              }}
              className="deck-volume-slider"
            />
          </div>
        </footer>
      )}
    </div>

      {/* --- ADD DIRECTORIES BULK MODAL --- */}
      <UploadModal 
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={handleUploadTrack}
        isCloudConfigured={isCloudConfigured}
        uploaderName={userName}
      />

      {/* --- PREMIUM PLAYLIST SELECTOR MODAL --- */}
    </>
  );
}
