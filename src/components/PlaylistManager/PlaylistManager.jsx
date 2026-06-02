import React, { useState } from 'react';
import { Plus, FolderHeart, Trash2, Play, Music, ArrowLeft, Trash } from 'lucide-react';
import { generateCoverGradient } from '../SongCard/SongCard';
import './PlaylistManager.css';

export default function PlaylistManager({
  playlists,
  songs,
  onCreatePlaylist,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onPlaySong
}) {
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);

  // Find currently active playlist object
  const activePlaylist = playlists.find(pl => pl.id === selectedPlaylistId);

  // Fetch all song objects that belong to the active playlist
  const playlistSongs = activePlaylist
    ? activePlaylist.songIds
        .map(id => songs.find(s => s.id === id))
        .filter(Boolean) // Remove any undefined entries
    : [];

  const handleCreate = (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    onCreatePlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setShowCreator(false);
  };

  const playPlaylist = () => {
    if (playlistSongs.length === 0) return;
    // Play first song of the playlist
    onPlaySong(playlistSongs[0], playlistSongs);
  };

  // Convert duration to mm:ss format
  const formatDuration = (secs) => {
    if (!secs) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Calculate total playlist duration
  const totalDuration = playlistSongs.reduce((acc, song) => acc + (song.duration || 0), 0);

  return (
    <div className="playlist-manager-container animate-fade-in">
      
      {/* HEADER ACTION AREA */}
      {!activePlaylist ? (
        <>
          <div className="tab-header">
            <h2 className="text-gradient">Your Playlists</h2>
            <button className="btn-primary" onClick={() => setShowCreator(!showCreator)}>
              <Plus size={16} />
              <span>New Playlist</span>
            </button>
          </div>

          {/* New Playlist Creator Box */}
          {showCreator && (
            <form className="playlist-creator-form glass-panel animate-slide-in" onSubmit={handleCreate}>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                placeholder="Enter playlist name..."
                maxLength={25}
                required
                autoFocus
              />
              <div className="creator-actions">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setShowCreator(false)}>Cancel</button>
                <button type="submit" className="btn-primary btn-sm">Create</button>
              </div>
            </form>
          )}

          {/* PLAYLISTS CARD GRID */}
          {playlists.length === 0 ? (
            <div className="empty-playlists glass-panel">
              <FolderHeart size={48} className="empty-icon" />
              <h3>No Playlists Yet</h3>
              <p>Create a custom playlist to group your uploaded and downloaded offline songs.</p>
            </div>
          ) : (
            <div className="playlists-grid">
              {playlists.map(pl => {
                const count = pl.songIds.length;
                const plGradient = generateCoverGradient(pl.name);
                
                return (
                  <div key={pl.id} className="playlist-card glass-panel" onClick={() => setSelectedPlaylistId(pl.id)}>
                    <div className="playlist-cover" style={{ background: plGradient }}>
                      <Music size={36} className="pl-music-icon" />
                    </div>
                    <div className="playlist-info">
                      <h3 className="truncate">{pl.name}</h3>
                      <p>{count} {count === 1 ? 'song' : 'songs'}</p>
                    </div>
                    <button
                      className="playlist-delete-card-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete playlist "${pl.name}"?`)) {
                          onDeletePlaylist(pl.id);
                        }
                      }}
                      title="Delete Playlist"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* PLAYLIST DETAIL EXPANDED VIEW */
        <div className="playlist-detail-view animate-fade-in">
          {/* Back Action Row */}
          <button className="back-btn" onClick={() => setSelectedPlaylistId(null)}>
            <ArrowLeft size={16} />
            <span>All Playlists</span>
          </button>

          {/* Playlist Title Banner */}
          <div className="playlist-detail-header glass-panel">
            <div className="playlist-cover-large" style={{ background: generateCoverGradient(activePlaylist.name) }}>
              <Music size={64} />
            </div>
            
            <div className="playlist-meta-details">
              <span className="meta-tag">PLAYLIST</span>
              <h1>{activePlaylist.name}</h1>
              <p className="meta-stats">
                <span>{playlistSongs.length} {playlistSongs.length === 1 ? 'track' : 'tracks'}</span>
                <span className="dot">•</span>
                <span>Total time {formatDuration(totalDuration)}</span>
              </p>

              {playlistSongs.length > 0 && (
                <button className="btn-primary playlist-play-btn" onClick={playPlaylist}>
                  <Play size={18} fill="currentColor" />
                  <span>Play Playlist</span>
                </button>
              )}
            </div>
          </div>

          {/* TRACKS LIST */}
          <div className="playlist-tracks-section">
            <h3>Tracks</h3>
            {playlistSongs.length === 0 ? (
              <div className="empty-tracks glass-panel">
                <Music size={32} className="text-dark" />
                <p>No songs inside this playlist. Go to <strong>My Songs</strong> tab to add items!</p>
              </div>
            ) : (
              <div className="tracks-list">
                {playlistSongs.map((song, index) => {
                  const songGradient = generateCoverGradient(song.title);
                  return (
                    <div 
                      key={song.id} 
                      className="track-row glass-panel"
                      onClick={() => onPlaySong(song, playlistSongs)}
                    >
                      <span className="track-number">{index + 1}</span>
                      
                      {/* Song art */}
                      <div className="track-row-cover">
                        {song.coverBlob || song.coverUrl ? (
                          <img src={song.coverUrl ? song.coverUrl : URL.createObjectURL(song.coverBlob)} alt="" />
                        ) : (
                          <div className="dynamic-cover-mini" style={{ background: songGradient }}>
                            {song.title.substring(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      {/* Song Labels */}
                      <div className="track-row-details">
                        <span className="track-row-title truncate">{song.title}</span>
                        <span className="track-row-artist truncate">{song.artist}</span>
                      </div>

                      <span className="track-row-genre">{song.genre}</span>
                      <span className="track-row-time">{formatDuration(song.duration)}</span>
                      
                      {/* Delete from Playlist */}
                      <button
                        className="track-row-remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromPlaylist(song.id, activePlaylist.id);
                        }}
                        title="Remove from Playlist"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
