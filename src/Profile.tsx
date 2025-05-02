import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";

const relationships = [
  "Friend",
  "Partner",
  "Family",
  "Parent",
  "Former Partner",
  "Colleague",
  "School",
] as const;

type Relationship = typeof relationships[number];

export function Profile() {
  const user = useQuery(api.auth.loggedInUser);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const updateProfile = useMutation(api.profiles.update);
  const updatePicture = useMutation(api.profiles.updatePicture);
  const generateUploadUrl = useMutation(api.profiles.generateUploadUrl);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState<Relationship>("Friend");

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setRelationship(profile.relationship);
    }
  }, [profile]);

  if (!user) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) return;
    
    try {
      await updateProfile({ 
        name,
        relationship
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      toast.error("Failed to update profile");
      console.error(error);
    }
  }

  async function handlePictureUpload(e: React.ChangeEvent<HTMLInputElement>) {
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
      if (!result.ok) {
        throw new Error("Failed to upload image");
      }
      const { storageId } = await result.json();
      await updatePicture({ storageId });
      toast.success("Profile picture updated!");
    } catch (error) {
      toast.error("Failed to update profile picture");
      console.error(error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-emerald-800 mb-4">
          {profile?.name ? `Welcome, ${profile.name}!` : "Complete Your Profile"}
        </h1>
        <p className="text-gray-600">
          {profile?.name 
            ? `You're connected as a ${profile.relationship.toLowerCase()} of Emily.`
            : "Tell us about yourself and your connection to Emily."}
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">Profile Picture</h2>
          <div className="flex items-center gap-6">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-100">
              {profile?.pictureUrl ? (
                <img 
                  src={profile.pictureUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  No Image
                </div>
              )}
            </div>
            <label className="bg-emerald-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-emerald-700">
              {uploading ? "Uploading..." : "Upload Picture"}
              <input
                type="file"
                accept="image/*"
                onChange={handlePictureUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Your Name</h2>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2 border rounded"
            required
          />
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Relationship to Emily</h2>
          <select
            value={relationship}
            onChange={(e) => setRelationship(e.target.value as Relationship)}
            className="w-full p-2 border rounded"
          >
            {relationships.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700"
        >
          Save Profile
        </button>
      </form>
    </div>
  );
}
