import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Repeat, 
  Shuffle 
} from 'lucide-react';
import { generateCoverGradient } from '../SongCard/SongCard';
import './AudioPlayer.css';

export default function AudioPlayer({ 
  currentTrack, 
  isPlaying, 
  setIsPlaying, 
  onNext, 
  onPrev,
  setAnalyser // Passes AnalyserNode back to App.jsx for the visualizer
}) {
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const analyserRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);

  // --- AUDIO SOURCE LIFECYCLE ---
  useEffect(() => {
    if (!audioRef.current) return;

    // Load new track
    if (currentTrack) {
      // If it's a local/offline blob
      if (currentTrack.audioBlob) {
        const audioUrl = URL.createObjectURL(currentTrack.audioBlob);
        audioRef.current.src = audioUrl;

        // Clean up object URL on track change
        return () => URL.revokeObjectURL(audioUrl);
      } else if (currentTrack.url) {
        // If streaming online
        audioRef.current.src = currentTrack.url;
      }
      
      audioRef.current.load();
      if (isPlaying) {
        playAudio();
      }
    }
  }, [currentTrack]);

  // Handle Play/Pause trigger from parent/external clicks
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      playAudio();
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Synchronize local volume slider with actual audio tag
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // --- WEB AUDIO API INTERFACING FOR VISUALIZER ---
  const initWebAudio = () => {
    if (audioCtxRef.current) return; // Already initialized

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128; // Small fftSize for clean bar visualizer (64 bands)
      
      // Connect HTML5 element to context
      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioCtxRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      setAnalyser(analyser);
    } catch (e) {
      console.error('Failed to initialize Web Audio Analyser:', e);
    }
  };

  const playAudio = () => {
    if (!audioRef.current) return;

    // Initialize/resume AudioContext on user action (browser security bypass)
    initWebAudio();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((err) => {
        console.error('Playback failed:', err);
        setIsPlaying(false);
      });
  };

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
  };

  // Time Updates
  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  // Scrubbing seeker
  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  // Skip tracks triggers
  const handleTrackEnded = () => {
    if (isLooping) {
      audioRef.current.currentTime = 0;
      playAudio();
    } else {
      onNext(isShuffle);
    }
  };

  // Volume utilities
  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={18} />;
    if (volume < 0.3) return <Volume1 size={18} />;
    return <Volume2 size={18} />;
  };

  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (!currentTrack) return null;

  const coverGradient = currentTrack.coverGradient || generateCoverGradient(currentTrack.title);

  return (
    <div className="audio-player-wrapper glass-panel animate-slide-in">
      <audio
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleTrackEnded}
      />

      <div className="player-grid">
        {/* LEFT COMPONENT: Track Info */}
        <div className="track-info">
          <div className={`track-cover-container ${isPlaying ? 'spinning' : ''}`}>
            {currentTrack.coverBlob ? (
              <img 
                src={URL.createObjectURL(currentTrack.coverBlob)} 
                alt={currentTrack.title} 
                className="track-cover" 
              />
            ) : (
              <div className="dynamic-cover-small" style={{ background: coverGradient }}>
                {currentTrack.title.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="track-details">
            <h4 className="track-name truncate" title={currentTrack.title}>
              {currentTrack.title}
            </h4>
            <p className="track-artist truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* MIDDLE COMPONENT: Media Controller */}
        <div className="player-controls-container">
          <div className="control-buttons">
            {/* Shuffle */}
            <button 
              className={`control-btn secondary-btn ${isShuffle ? 'active' : ''}`}
              onClick={() => setIsShuffle(!isShuffle)}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>

            {/* Prev */}
            <button className="control-btn" onClick={onPrev} title="Previous Song">
              <SkipBack size={18} fill="currentColor" />
            </button>

            {/* Play/Pause */}
            <button className="control-btn play-btn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" className="play-icon-offset" />
              )}
            </button>

            {/* Next */}
            <button className="control-btn" onClick={() => onNext(isShuffle)} title="Next Song">
              <SkipForward size={18} fill="currentColor" />
            </button>

            {/* Loop */}
            <button 
              className={`control-btn secondary-btn ${isLooping ? 'active' : ''}`}
              onClick={() => setIsLooping(!isLooping)}
              title="Repeat"
            >
              <Repeat size={16} />
            </button>
          </div>

          {/* Scrub Seekbar */}
          <div className="seekbar-container">
            <span className="time-label">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="seekbar-slider"
              aria-label="Track progress"
            />
            <span className="time-label">{formatTime(duration)}</span>
          </div>
        </div>

        {/* RIGHT COMPONENT: Action / Volume Deck */}
        <div className="volume-deck">
          <button className="volume-icon" onClick={toggleMute} aria-label="Mute toggle">
            {getVolumeIcon()}
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
            className="volume-slider"
            aria-label="Volume controller"
          />
        </div>
      </div>
    </div>
  );
}
