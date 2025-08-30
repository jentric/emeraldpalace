import React, { useState } from "react";
import { useConvexAuth } from "convex/react";
import UploadModal from "./UploadModal";
import PostModal from "./PostModal";

export default function ActionButtons() {
  const { isAuthenticated } = useConvexAuth();
  const [showUploadInfo, setShowUploadInfo] = useState(false);
  const [showPostInfo, setShowPostInfo] = useState(false);
  const [openUpload, setOpenUpload] = useState(false);
  const [openPost, setOpenPost] = useState(false);

  if (!isAuthenticated) return null;

  const handlePost = () => {
    // Navigate to blog/forum page or open post modal
    setOpenPost(true);
    // Dispatch custom event for other components to handle
    const event = new CustomEvent('actionButtonClick', {
      detail: { action: 'post', source: 'floating-button' }
    });
    window.dispatchEvent(event);
  };

  const handleUpload = () => {
    // Open file upload dialog or navigate to upload page
    setOpenUpload(true);
    // Dispatch custom event for other components to handle
    const event = new CustomEvent('actionButtonClick', {
      detail: { action: 'upload', source: 'floating-button' }
    });
    window.dispatchEvent(event);
  };

  return (
    <div className="ep-action-buttons" role="region" aria-label="Quick action buttons">
      {/* Upload Button with Info Icon */}
      <div className="relative">
        <button
          onClick={handleUpload}
          className="ep-action-btn ep-upload-btn ep-btn group"
          aria-label="Upload media or files to your timeline"
          title="Upload media or files (opens file picker)"
        >
          <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">⬆</span>
          <span className="sr-only">Upload content</span>
        </button>

        {/* Info Icon */}
        <button
          onClick={() => setShowUploadInfo(!showUploadInfo)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-black rounded-full flex items-center justify-center text-xs text-white hover:bg-gray-800 transition-colors"
          aria-label="More information about upload feature"
          title="Learn about uploading"
        >
          ℹ
        </button>

        {/* Info Tooltip */}
        {showUploadInfo && (
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-black text-white text-xs rounded-lg shadow-lg max-w-xs z-50">
            <div className="font-semibold mb-1">Upload Content</div>
            <p>Share your favorite photos, videos, and documents with the community. Files are securely stored and shared.</p>
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
          </div>
        )}
      </div>

      {/* Post Button with Info Icon */}
      <div className="relative">
        <button
          onClick={handlePost}
          className="ep-action-btn ep-post-btn ep-btn group"
          aria-label="Create a new post in the forum"
          title="Create a new forum post (opens post composer)"
        >
          <span className="text-lg transition-transform group-hover:scale-110" aria-hidden="true">📝</span>
          <span className="sr-only">Create post</span>
        </button>

        {/* Info Icon */}
        <button
          onClick={() => setShowPostInfo(!showPostInfo)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-black rounded-full flex items-center justify-center text-xs text-white hover:bg-gray-800 transition-colors"
          aria-label="More information about posting feature"
          title="Learn about posting"
        >
          ℹ
        </button>

        {/* Info Tooltip */}
        {showPostInfo && (
          <div className="absolute bottom-full right-0 mb-2 p-3 bg-black text-white text-xs rounded-lg shadow-lg max-w-xs z-50">
            <div className="font-semibold mb-1">Create Posts</div>
            <p>Share your thoughts, stories, and connect with others in the community forum. Start conversations and build connections.</p>
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
          </div>
        )}
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite" id="action-instructions">
        Use the upload button to add media files, or the post button to share your thoughts in the community forum.
      </div>

      {/* Modals */}
      <UploadModal isOpen={openUpload} onClose={() => setOpenUpload(false)} />
      <PostModal isOpen={openPost} onClose={() => setOpenPost(false)} />
    </div>
  );
}


