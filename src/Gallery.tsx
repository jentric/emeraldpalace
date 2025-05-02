import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Comments } from "./components/Comments";

export default function Gallery() {
  const media = useQuery(api.media.list);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const [uploading, setUploading] = useState(false);
  
  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setUploading(true);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      await createMedia({
        title: file.name,
        type: file.type.startsWith("image/") ? "image" : "video",
        storageId,
      });
    } finally {
      setUploading(false);
    }
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-emerald-800 mb-8">Photographs & Videos</h1>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          Please complete your profile to view and share media.
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-emerald-800">Photographs & Videos</h1>
        <label className="bg-emerald-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-emerald-700">
          {uploading ? "Uploading..." : "Upload Media"}
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {media?.map((item) => (
          <MediaCard key={item._id} item={item} />
        ))}
      </div>
    </div>
  );
}

function MediaCard({ item }: { item: any }) {
  const profile = useQuery(api.profiles.get, { userId: item.authorId });
  const updateMedia = useMutation(api.media.update);
  const [isEditing, setIsEditing] = useState(false);
  const [caption, setCaption] = useState(item.caption || "");
  
  async function handleSaveCaption() {
    await updateMedia({ id: item._id, caption });
    setIsEditing(false);
  }
  
  return (
    <div className="rounded-lg overflow-hidden shadow-lg">
      {item.type === "image" ? (
        <img src={item.url} alt={item.title} className="w-full h-64 object-cover" />
      ) : (
        <video src={item.url} controls className="w-full h-64 object-cover" />
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold">{item.title}</h3>
        
        {isEditing ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full p-2 border rounded"
              placeholder="Add a caption..."
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveCaption}
                className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setCaption(item.caption || "");
                }}
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2">
            {item.caption ? (
              <p className="text-gray-600">{item.caption}</p>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-emerald-600 hover:text-emerald-700"
              >
                Add caption
              </button>
            )}
            {item.caption && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-emerald-600 hover:text-emerald-700 ml-2"
              >
                Edit
              </button>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-2 mt-4">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            {profile?.pictureUrl ? (
              <img 
                src={profile.pictureUrl} 
                alt="Author" 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                ?
              </div>
            )}
          </div>
          <span className="text-sm text-gray-600">
            {profile?.name ?? "Anonymous"}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-1">
          {new Date(item.createdAt).toLocaleDateString()}
        </p>

        <Comments targetType="media" targetId={item._id} />
      </div>
    </div>
  );
}
