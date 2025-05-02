import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";
import { Comments } from "./components/Comments";
import { Id } from "../convex/_generated/dataModel";

const relationshipTypes = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

type Relationship = typeof relationshipTypes[number];

export default function Gallery() {
  const media = useQuery(api.media.list);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<number | null>(null);
  const [selectedRelationships, setSelectedRelationships] = useState<Relationship[]>([...relationshipTypes]);
  
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
        visibleTo: selectedRelationships,
      });
    } finally {
      setUploading(false);
    }
  }

  const toggleRelationship = (relationship: Relationship) => {
    setSelectedRelationships(prev => 
      prev.includes(relationship)
        ? prev.filter(r => r !== relationship)
        : [...prev, relationship]
    );
  };

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

  const handlePrevious = () => {
    if (selectedMedia !== null && media && selectedMedia > 0) {
      setSelectedMedia(selectedMedia - 1);
    }
  };

  const handleNext = () => {
    if (selectedMedia !== null && media && selectedMedia < media.length - 1) {
      setSelectedMedia(selectedMedia + 1);
    }
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 mb-8">
        <div className="flex justify-between items-center">
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
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Who can view this media?</h3>
          <div className="flex flex-wrap gap-2">
            {relationshipTypes.map(relationship => (
              <button
                key={relationship}
                onClick={() => toggleRelationship(relationship)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedRelationships.includes(relationship)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {relationship}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {media?.map((item, index) => (
          <div 
            key={item._id}
            onClick={() => setSelectedMedia(index)}
            className="aspect-square relative overflow-hidden rounded-lg cursor-pointer group"
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
                muted 
                loop 
                playsInline
                onMouseEnter={e => e.currentTarget.play()}
                onMouseLeave={e => e.currentTarget.pause()}
              />
            )}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity" />
            {item.caption && (
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-sm">{item.caption}</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Full Screen Modal */}
      {selectedMedia !== null && media && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <button 
            onClick={() => setSelectedMedia(null)}
            className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300"
          >
            ×
          </button>
          
          <button
            onClick={handlePrevious}
            disabled={selectedMedia === 0}
            className="absolute left-4 text-white text-4xl hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          
          <button
            onClick={handleNext}
            disabled={selectedMedia === media.length - 1}
            className="absolute right-4 text-white text-4xl hover:text-gray-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ›
          </button>

          <div className="max-w-7xl max-h-[90vh] w-full mx-8 flex flex-col">
            <div className="flex-1 flex items-center justify-center min-h-0">
              {media[selectedMedia].type === "image" ? (
                <img
                  src={media[selectedMedia].url || undefined}
                  alt={media[selectedMedia].title}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <video
                  src={media[selectedMedia].url || undefined}
                  controls
                  autoPlay
                  className="max-h-full max-w-full"
                />
              )}
            </div>
            
            <div className="mt-4 bg-black/50 p-4 rounded-lg">
              <h3 className="text-white text-lg font-semibold mb-2">
                {media[selectedMedia].title}
              </h3>
              {media[selectedMedia].caption && (
                <p className="text-gray-200 mb-4">{media[selectedMedia].caption}</p>
              )}
              <div className="mb-4">
                <h4 className="text-gray-300 text-sm mb-2">Visible to:</h4>
                <div className="flex flex-wrap gap-2">
                  {media[selectedMedia].visibleTo?.map(relationship => (
                    <span key={relationship} className="px-2 py-1 bg-gray-700 text-white rounded-full text-xs">
                      {relationship}
                    </span>
                  ))}
                </div>
              </div>
              <Comments 
                targetType="media" 
                targetId={media[selectedMedia]._id as Id<"mediaItems">} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
