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
          aria-describedby="upload-info"
          title="Upload media or files (opens file picker)"
        >
          <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden="true">⬆</span>
          <span className="sr-only">Upload content</span>
        </button>

        {/* Accessibility-only explainer for upload (kept for screen readers) */}
        <div id="upload-info" className="sr-only" aria-hidden="false">
          Use the upload button to add photos, videos, or documents to your timeline. Files are securely stored and shared.
        </div>
      </div>

      {/* Post Button with Info Icon */}
      <div className="relative">
        <button
          onClick={handlePost}
          className="ep-action-btn ep-post-btn ep-btn group"
          aria-label="Write a new message to Emily"
          aria-describedby="post-info"
          title="Write a new message to Emily (opens composer)"
        >
          <span className="text-2xl transition-transform group-hover:scale-110" aria-hidden="true">📝</span>
          <span className="sr-only">Create message</span>
        </button>

        {/* Accessibility-only explainer for post (kept for screen readers) */}
        <div id="post-info" className="sr-only" aria-hidden="false">
          Use the message button to write a new message to Emily; opens the composer.
        </div>
      </div>

      {/* Screen reader instructions */}
      <div className="sr-only" aria-live="polite" id="action-instructions">
        Use the upload button to add media files, or the message button to write to Emily.
      </div>

      {/* Modals */}
      <UploadModal isOpen={openUpload} onClose={() => setOpenUpload(false)} />
      <PostModal isOpen={openPost} onClose={() => setOpenPost(false)} />
    </div>
  );
}
