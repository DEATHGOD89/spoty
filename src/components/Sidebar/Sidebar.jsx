import React from 'react';
import { 
  Home, 
  Library, 
  PlusCircle, 
  Radio, 
  Wifi, 
  WifiOff, 
  Layers, 
  Sliders 
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar({ 
  currentTab, 
  setCurrentTab, 
  isOnline, 
  setIsOnline, 
  openUploadModal 
}) {
  const navItems = [
    { id: 'discover', label: 'Discover', icon: Radio, onlineOnly: true },
    { id: 'library', label: 'My Songs', icon: Library, onlineOnly: false },
    { id: 'playlists', label: 'Playlists', icon: Layers, onlineOnly: false },
  ];

  return (
    <>
      {/* PC DESKTOP SIDEBAR */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-brand">
          <div className="brand-logo-container">
            <div className="brand-dot"></div>
          </div>
          <h2>Spoty</h2>
        </div>

        {/* Network Mode Switcher Card */}
        <div className={`network-card ${isOnline ? 'online' : 'offline'}`}>
          <div className="network-status">
            {isOnline ? (
              <>
                <Wifi className="network-icon pulse" size={18} />
                <span>ONLINE MODE</span>
              </>
            ) : (
              <>
                <WifiOff className="network-icon" size={18} />
                <span>OFFLINE MODE</span>
              </>
            )}
          </div>
          <p className="network-desc">
            {isOnline 
              ? 'Streaming shared music & enabling downloads.' 
              : 'Playing local IndexedDB and downloaded tracks.'}
          </p>
          <div className="toggle-container">
            <span className="toggle-label">Go Offline</span>
            <button 
              className={`toggle-switch ${!isOnline ? 'active' : ''}`}
              onClick={() => setIsOnline(!isOnline)}
              aria-label="Toggle network mode"
            >
              <span className="toggle-slider"></span>
            </button>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Browse</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            // Disable or hide online-only tabs when offline
            const isDisabled = item.onlineOnly && !isOnline;
            
            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && setCurrentTab(item.id)}
                className={`nav-item ${currentTab === item.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
                title={isDisabled ? 'Requires Online Mode' : ''}
              >
                <Icon size={20} />
                <span>{item.label}</span>
                {item.onlineOnly && <span className="badge-online">Global</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Contributor Panel */}
        <div className="sidebar-footer">
          <button className="btn-primary w-full" onClick={openUploadModal}>
            <PlusCircle size={18} />
            <span>Upload MP3</span>
          </button>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="mobile-bottom-bar glass-panel">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = item.onlineOnly && !isOnline;
          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setCurrentTab(item.id)}
              className={`mobile-nav-item ${currentTab === item.id ? 'active' : ''} ${isDisabled ? 'disabled' : ''}`}
            >
              <Icon size={22} />
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
        <button className="mobile-nav-item upload-btn" onClick={openUploadModal}>
          <PlusCircle size={24} className="text-gradient-purple" />
          <span className="mobile-nav-label">Upload</span>
        </button>
        <button 
          className={`mobile-nav-item network-toggle-btn ${isOnline ? 'online' : 'offline'}`}
          onClick={() => setIsOnline(!isOnline)}
        >
          {isOnline ? <Wifi size={22} /> : <WifiOff size={22} />}
          <span className="mobile-nav-label">{isOnline ? 'Online' : 'Offline'}</span>
        </button>
      </nav>
    </>
  );
}
