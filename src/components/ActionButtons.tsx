import React from "react";
import { useConvexAuth } from "convex/react";

export default function ActionButtons() {
  const { isAuthenticated } = useConvexAuth();

  if (!isAuthenticated) return null;

  const handlePost = () => {
    // Navigate to blog/forum page or open post modal
    console.log("Post button clicked");
    // You could dispatch an event or use navigation here
  };

  const handleUpload = () => {
    // Open file upload dialog or navigate to upload page
    console.log("Upload button clicked");
    // You could dispatch an event or use navigation here
  };

  return (
    <div className="ep-action-buttons" role="region" aria-label="Action buttons">
      <button
        onClick={handleUpload}
        className="ep-action-btn ep-upload-btn"
        aria-label="Upload content"
        title="Upload"
      >
        <span className="text-lg">⬆</span>
      </button>
      <button
        onClick={handlePost}
        className="ep-action-btn ep-post-btn"
        aria-label="Create post"
        title="Post"
      >
        <span className="text-lg">📝</span>
      </button>
    </div>
  );
}


