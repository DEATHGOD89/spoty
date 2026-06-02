import React, { useState } from 'react';
import { Play, Pause, Download, Trash2, Plus, Check } from 'lucide-react';
import './SongCard.css';

// Generates a beautiful dynamic gradient from a string's hashcode
export function generateCoverGradient(text) {
  if (!text) return 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)';
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 45) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 55%) 0%, hsl(${h2}, 80%, 45%) 100%)`;
}

export default function SongCard({ 
  song, 
  currentTrack, 
  isPlaying, 
  onPlay, 
  onDownload, 
  onDelete, 
  isDownloaded,
  playlists,
  onAddToPlaylist
}) {
  const [showPlaylists, setShowPlaylists] = useState(false);
  const isActive = currentTrack && currentTrack.id === song.id;

  // Render song duration (m:ss)
  const formatTime = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const coverGradient = song.coverGradient || generateCoverGradient(song.title);

  return (
    <div className={`song-card glass-panel ${isActive ? 'active' : ''}`}>
      {/* Cover Artwork Container */}
      <div className="card-cover-container">
        {song.coverBlob ? (
          <img 
            src={URL.createObjectURL(song.coverBlob)} 
            alt={song.title} 
            className="card-cover-image" 
          />
        ) : (
          <div className="dynamic-cover" style={{ background: coverGradient }}>
            {song.title.substring(0, 2).toUpperCase()}
          </div>
        )}
        
        {/* Play overlay button */}
        <button 
          className={`play-overlay-btn ${isActive && isPlaying ? 'playing' : ''}`}
          onClick={() => onPlay(song)}
          aria-label={isActive && isPlaying ? 'Pause song' : 'Play song'}
        >
          {isActive && isPlaying ? (
            <Pause size={24} fill="currentColor" />
          ) : (
            <Play size={24} fill="currentColor" className="play-icon-offset" />
          )}
        </button>

        {/* Dynamic Badge */}
        <span className={`badge ${song.isUserUpload || isDownloaded ? 'badge-offline' : 'badge-online'}`}>
          {song.isUserUpload || isDownloaded ? 'Offline Ready' : 'Global Network'}
        </span>
      </div>

      {/* Info Content */}
      <div className="card-details">
        <h3 className="song-title truncate" title={song.title}>
          {song.title}
        </h3>
        <p className="song-artist truncate">{song.artist}</p>
        
        <div className="card-meta">
          <span className="song-genre">{song.genre}</span>
          <span className="song-duration">{formatTime(song.duration)}</span>
        </div>

        {/* Action Controls */}
        <div className="card-actions">
          {/* Download button (For online community songs not yet downloaded) */}
          {!song.isUserUpload && !isDownloaded && onDownload && (
            <button 
              className="action-btn download-btn" 
              onClick={() => onDownload(song)}
              title="Download to Local Offline Storage"
            >
              <Download size={16} />
            </button>
          )}

          {/* Downloaded Check Indicator */}
          {!song.isUserUpload && isDownloaded && (
            <div className="download-indicator" title="Downloaded Offline">
              <Check size={16} className="text-accent" />
            </div>
          )}

          {/* Add to Playlist trigger */}
          {playlists && playlists.length > 0 && onAddToPlaylist && (
            <div className="playlist-trigger-container">
              <button 
                className={`action-btn ${showPlaylists ? 'active' : ''}`}
                onClick={() => setShowPlaylists(!showPlaylists)}
                title="Add to Playlist"
              >
                <Plus size={16} />
              </button>
              
              {showPlaylists && (
                <div className="playlist-popover glass-panel animate-fade-in">
                  <div className="popover-header">Add to:</div>
                  <div className="popover-list">
                    {playlists.map(pl => {
                      const hasSong = pl.songIds.includes(song.id);
                      return (
                        <button
                          key={pl.id}
                          className={`popover-item ${hasSong ? 'added' : ''}`}
                          onClick={() => {
                            onAddToPlaylist(song.id, pl.id);
                            setShowPlaylists(false);
                          }}
                        >
                          <span>{pl.name}</span>
                          {hasSong && <Check size={12} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trash Delete (Delete local/offline files or custom uploads) */}
          {(song.isUserUpload || isDownloaded) && onDelete && (
            <button 
              className="action-btn delete-btn" 
              onClick={() => onDelete(song.id)}
              title="Delete from Offline storage"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
