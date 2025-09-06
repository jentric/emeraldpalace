import React, { useState, useRef } from "react";
import { useVideo } from "./VideoContext";

// Suggestion Modal Component
function SuggestionModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [suggestion, setSuggestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;

    setIsSubmitting(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Song suggestion submitted:", suggestion);
      alert("Thank you for your suggestion! We'll review it and add it to the collection if it fits Em's style.");
      setSuggestion("");
      setIsSubmitting(false);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999]" role="dialog" aria-modal="true" aria-labelledby="suggestion-title">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 max-w-md w-full mx-4 border border-black/20 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 id="suggestion-title" className="text-lg font-semibold">💡 Suggest a Song</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center transition-colors"
            aria-label="Close suggestion modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div>
            <label htmlFor="song-suggestion" className="block text-sm font-medium mb-2">
              What song would you like to suggest?
            </label>
            <textarea
              id="song-suggestion"
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              placeholder="Enter the song title and artist (e.g., 'Dream On by Aerosmith')"
              className="w-full p-3 border border-black/30 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/30 resize-none"
              rows={3}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="text-xs opacity-70">
            💝 Help us build Em's perfect playlist! We'll review all suggestions and add songs that match the collection's vibe.
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-black/30 rounded-xl bg-white/50 hover:bg-white/70 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!suggestion.trim() || isSubmitting}
            >
              {isSubmitting ? "Sending..." : "Submit Suggestion"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Playlist() {
  const { playlist, currentIndex, setIndex } = useVideo();
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestionModal, setShowSuggestionModal] = useState(false);

  const handleSongClick = (index: number) => {
    setIndex(index);
    setIsOpen(false);
  };

  // Listen for external toggle/open events (e.g., from overflow menu)
  React.useEffect(() => {
    const toggle = () => setIsOpen((v) => !v);
    const open = () => setIsOpen(true);
    window.addEventListener("ep:playlist-toggle", toggle as EventListener);
    window.addEventListener("ep:playlist-open", open as EventListener);
    return () => {
      window.removeEventListener("ep:playlist-toggle", toggle as EventListener);
      window.removeEventListener("ep:playlist-open", open as EventListener);
    };
  }, []);

  // Announce playlist open state for external UI (e.g., player bar) to consume for accessibility
  React.useEffect(() => {
    try { window.dispatchEvent(new CustomEvent("ep:playlist-state", { detail: isOpen })); } catch { /* ignore */ }
  }, [isOpen]);

  return (
    <>
      {/* Playlist is toggled from the player-bar container; button removed to provide a single consolidated toggle target. */}
      
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
                  aria-label={`Play ${song.name.replace('.mp4', '')}`}
                  aria-current={index === currentIndex ? "true" : "false"}
                  role="listitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSongClick(index);
                    }
                  }}
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
                onClick={() => setShowSuggestionModal(true)}
                className="ep-recommend-btn ep-btn ep-btn--pink"
                aria-label="Suggest more songs to add to the playlist"
                title="Open suggestion form"
              >
                <span className="text-sm">💡</span>
                <span className="ml-2 text-xs">Suggest More</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suggestion Modal */}
      <SuggestionModal
        isOpen={showSuggestionModal}
        onClose={() => setShowSuggestionModal(false)}
      />
    </>
  );
}
