import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useVideo } from './VideoContext';

interface VideoControlsProps {
  filename: string;
  className?: string;
}

export default function ModernVideoControls({ filename, className = '' }: VideoControlsProps) {
  const { isPlaying, play, pause, muted, setMuted, volume, setVolume, next, prev, currentIndex, playlist } = useVideo();

  const [isVisible, setIsVisible] = useState(true);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const autoHideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-hide controls after 3 seconds of inactivity
  const resetAutoHide = useCallback(() => {
    if (autoHideTimeoutRef.current) {
      clearTimeout(autoHideTimeoutRef.current);
    }
    setIsVisible(true);
    const timeout = setTimeout(() => setIsVisible(false), 3000);
    autoHideTimeoutRef.current = timeout;
  }, []); // No dependencies needed with useRef

  // Show controls on mouse movement or key press
  useEffect(() => {
    const handleActivity = () => resetAutoHide();

    document.addEventListener('mousemove', handleActivity);
    document.addEventListener('keydown', handleActivity);
    document.addEventListener('touchstart', handleActivity);

    resetAutoHide(); // Initial setup

    return () => {
      document.removeEventListener('mousemove', handleActivity);
      document.removeEventListener('keydown', handleActivity);
      document.removeEventListener('touchstart', handleActivity);
      if (autoHideTimeoutRef.current) {
        clearTimeout(autoHideTimeoutRef.current);
      }
    };
  }, [resetAutoHide]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);

    // Auto-unmute if volume is increased from 0
    if (newVolume > 0 && muted) {
      setMuted(false);
    }
  }, [setVolume, setMuted, muted]);

  const toggleMute = useCallback(() => {
    setMuted(!muted);
    if (!muted && volume === 0) {
      setVolume(0.5); // Set reasonable volume when unmuting
    }
  }, [muted, volume, setMuted, setVolume]);

  const formatFilename = (name: string) => {
    return name.replace(/\.[^/.]+$/, ''); // Remove file extension
  };

  return (
    <div
      className={`modern-video-controls ${className} ${isVisible ? 'visible' : 'hidden'}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={resetAutoHide}
    >
      {/* Track Info */}
      <div className="track-info">
        <div className="track-title">{formatFilename(filename)}</div>
        <div className="track-counter">
          {currentIndex + 1} / {playlist.length}
        </div>
      </div>

      {/* Main Controls */}
      <div className="main-controls">
        <button
          type="button"
          className="control-btn prev-btn"
          onClick={prev}
          disabled={playlist.length <= 1}
          aria-label="Previous track"
          title="Previous track"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button
          type="button"
          className="control-btn play-pause-btn"
          onClick={togglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <button
          type="button"
          className="control-btn next-btn"
          onClick={next}
          disabled={playlist.length <= 1}
          aria-label="Next track"
          title="Next track"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      {/* Volume Controls */}
      <div className="volume-controls">
        <button
          type="button"
          className="control-btn volume-btn"
          onClick={toggleMute}
          onMouseEnter={() => setShowVolumeSlider(true)}
          aria-label={muted ? "Unmute" : "Mute"}
          title={muted ? "Unmute" : "Mute"}
        >
          {muted || volume === 0 ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : volume < 0.5 ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71z"/>
            </svg>
          )}
        </button>

        <div
          className={`volume-slider-container ${showVolumeSlider ? 'visible' : ''}`}
          onMouseEnter={() => setShowVolumeSlider(true)}
          onMouseLeave={() => setShowVolumeSlider(false)}
        >
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
            aria-label={`Volume: ${Math.round((muted ? 0 : volume) * 100)}%`}
            title={`Volume: ${Math.round((muted ? 0 : volume) * 100)}%`}
          />
          <div className="volume-level" style={{ width: `${(muted ? 0 : volume) * 100}%` }} />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-container">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: '0%' }} />
        </div>
      </div>
    </div>
  );
}
