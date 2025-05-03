import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Comments } from "./components/Comments";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type Relationship = typeof relationshipTypes[number];
const relationshipTypes = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

type UploadState = null | {
  file: File;
  title: string;
  caption?: string;
  visibleTo: Relationship[];
};

export default function Gallery() {
  const { results: media, status, loadMore } = usePaginatedQuery(
    api.media.list,
    { paginationOpts: { numItems: 15 } },
    { initialNumItems: 15 }
  );
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const deleteMedia = useMutation(api.media.remove);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const user = useQuery(api.auth.loggedInUser);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null);
  const [selectedRelationships, setSelectedRelationships] = useState<Relationship[]>([...relationshipTypes]);
  const [uploadState, setUploadState] = useState<UploadState>(null);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadState({
      file,
      title: file.name,
      visibleTo: [...relationshipTypes],
    });
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadState) return;

    try {
      setUploading(true);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": uploadState.file.type },
        body: uploadState.file,
      });
      if (!result.ok) {
        throw new Error("Failed to upload file");
      }
      const { storageId } = await result.json();
      await createMedia({
        title: uploadState.title,
        caption: uploadState.caption,
        type: uploadState.file.type.startsWith("image/") ? "image" : "video",
        storageId,
        visibleTo: uploadState.visibleTo,
      });
      setUploadState(null);
      toast.success("Media uploaded successfully!");
    } catch (error) {
      toast.error("Failed to upload media");
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mediaId: Id<"mediaItems">) {
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    try {
      await deleteMedia({ id: mediaId });
      toast.success("Media deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete media");
      console.error(error);
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
      <h1 className="text-3xl font-bold text-emerald-800 mb-8">Photographs & Videos</h1>

      {uploadState ? (
        <form onSubmit={handleUpload} className="mb-8 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                value={uploadState.title}
                onChange={(e) => setUploadState({ ...uploadState, title: e.target.value })}
                className="mt-1 w-full p-2 border rounded"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Caption (optional)</label>
              <input
                type="text"
                value={uploadState.caption || ""}
                onChange={(e) => setUploadState({ ...uploadState, caption: e.target.value })}
                className="mt-1 w-full p-2 border rounded"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Visible to</label>
              <div className="mt-2 space-x-2">
                {relationshipTypes.map((type) => (
                  <label key={type} className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={uploadState.visibleTo.includes(type)}
                      onChange={(e) => {
                        const newVisibleTo = e.target.checked
                          ? [...uploadState.visibleTo, type]
                          : uploadState.visibleTo.filter((t) => t !== type);
                        setUploadState({ ...uploadState, visibleTo: newVisibleTo });
                      }}
                      className="mr-1"
                    />
                    <span className="text-sm text-gray-600">{type}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
            <button
              type="button"
              onClick={() => setUploadState(null)}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <label className="block mb-8">
          <div className="p-8 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-gray-50">
            <div className="text-gray-600">Click to upload photos or videos</div>
            <div className="text-sm text-gray-500 mt-1">or drag and drop</div>
          </div>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </label>
      )}

      <div className="grid grid-cols-3 gap-4">
        {media?.map((item, index) => (
          <div key={item._id} className="relative group">
            <div 
              onClick={() => setSelectedMedia(index)}
              className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-100"
            >
              {item.type === "image" ? (
                <img
                  src={item.url || undefined}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <video
                  src={item.url || undefined}
                  className="w-full h-full object-cover"
                />
              )}
              {item.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-black/50 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.caption}
                </div>
              )}
            </div>
            {item.authorId === user?._id && (
              <button
                onClick={() => handleDelete(item._id)}
                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="mt-8 flex justify-center">
          <button
            onClick={() => loadMore(15)}
            className="bg-emerald-600 text-white px-6 py-2 rounded-full hover:bg-emerald-700"
          >
            Load More
          </button>
        </div>
      )}

      {status === "LoadingMore" && (
        <div className="mt-8 flex justify-center">
          <div className="bg-emerald-100 text-emerald-800 px-6 py-2 rounded-full">
            Loading...
          </div>
        </div>
      )}

      {selectedMedia !== null && media && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="max-w-4xl w-full mx-4 bg-white rounded-lg overflow-hidden">
            <div className="relative">
              {media[selectedMedia].type === "image" ? (
                <img
                  src={media[selectedMedia].url || undefined}
                  alt={media[selectedMedia].title}
                  className="w-full"
                />
              ) : (
                <video
                  src={media[selectedMedia].url || undefined}
                  controls
                  className="w-full"
                />
              )}
              <button
                onClick={() => setSelectedMedia(null)}
                className="absolute top-4 right-4 text-white bg-black/50 w-8 h-8 rounded-full flex items-center justify-center"
              >
                ×
              </button>
              {media[selectedMedia].authorId === user?._id && (
                <button
                  onClick={() => {
                    handleDelete(media[selectedMedia]._id);
                    setSelectedMedia(null);
                  }}
                  className="absolute top-4 right-16 text-white bg-red-600 px-3 py-1 rounded"
                >
                  Delete
                </button>
              )}
            </div>
            <div className="p-4">
              <h3 className="text-lg font-semibold">{media[selectedMedia].title}</h3>
              {media[selectedMedia].caption && (
                <p className="text-gray-600 mt-1">{media[selectedMedia].caption}</p>
              )}
              <Comments targetType="media" targetId={media[selectedMedia]._id} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
