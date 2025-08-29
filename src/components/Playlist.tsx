import React, { useState, useRef } from "react";
import { useVideo } from "./VideoContext";

export default function Playlist() {
  const { playlist, currentIndex, setIndex } = useVideo();
  const [isOpen, setIsOpen] = useState(false);
  const [recommendation, setRecommendation] = useState("");
  const [showRecommendation, setShowRecommendation] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSongClick = (index: number) => {
    setIndex(index);
    setIsOpen(false);
  };

  const handleRecommendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (recommendation.trim()) {
      // Here you could integrate with your backend to save recommendations
      console.log("Recommendation submitted:", recommendation.trim());
      setRecommendation("");
      setShowRecommendation(false);
      // You could show a toast or other feedback here
    }
  };

  return (
    <>
      {/* Playlist Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="ep-playlist-toggle"
        aria-label={isOpen ? "Close playlist" : "Open playlist"}
        aria-expanded={isOpen}
        aria-controls="playlist-panel"
      >
        <span className="text-lg">🎵</span>
        <span className="ml-1 text-xs">{isOpen ? "Hide" : "Songs"}</span>
      </button>

      {/* Playlist Panel */}
      {isOpen && (
        <div
          id="playlist-panel"
          className="ep-playlist-panel"
          role="region"
          aria-label="Music playlist"
        >
          <div className="ep-playlist-header">
            <h3 className="text-sm font-medium text-gray-800">Now Playing</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 p-1"
              aria-label="Close playlist"
            >
              ✕
            </button>
          </div>

          <div className="ep-playlist-content">
            <div className="ep-playlist-songs">
              {playlist.map((song, index) => (
                <button
                  key={index}
                  onClick={() => handleSongClick(index)}
                  className={`ep-playlist-song ${index === currentIndex ? "ep-playlist-song-active" : ""}`}
                  aria-label={`Play ${song.name}`}
                  aria-current={index === currentIndex ? "true" : "false"}
                >
                  <div className="ep-song-info">
                    <span className="ep-song-number">{(index + 1).toString().padStart(2, '0')}</span>
                    <div className="ep-song-details">
                      <span className="ep-song-title">{song.name.replace('.mp4', '')}</span>
                      {index === currentIndex && (
                        <span className="ep-now-playing">▶ Now Playing</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Recommendation Section */}
            <div className="ep-recommendation-section">
              <button
                onClick={() => setShowRecommendation(!showRecommendation)}
                className="ep-recommend-btn"
                aria-label="Recommend more songs"
                aria-expanded={showRecommendation}
              >
                <span className="text-sm">💡</span>
                <span className="ml-2 text-xs">Suggest More</span>
              </button>

              {showRecommendation && (
                <form onSubmit={handleRecommendSubmit} className="ep-recommend-form">
                  <input
                    ref={inputRef}
                    type="text"
                    value={recommendation}
                    onChange={(e) => setRecommendation(e.target.value)}
                    placeholder="Suggest a song or artist..."
                    className="ep-recommend-input"
                    aria-label="Song recommendation input"
                    maxLength={100}
                  />
                  <button
                    type="submit"
                    className="ep-recommend-submit"
                    disabled={!recommendation.trim()}
                    aria-label="Submit recommendation"
                  >
                    →
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


