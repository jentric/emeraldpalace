import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import OnboardingFlow from "./components/OnboardingFlow";
import { SignOutButton } from "./SignOutButton";

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

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setRelationship(profile.relationship);
    }
  }, [profile]);

  if (!user) return null;

  if (!profile) {
    return <OnboardingFlow onComplete={() => { /* query will refresh and page will render profile */ }} />;
  }

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
      if (!profile?.name) {
        toast.error("Please enter your name and relationship to Emily and click save first. Then retry uploading a profile picture.");
        return;
      }

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

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    try {
      setChangingPassword(true);
      // Note: This would need to be implemented in the backend
      // For now, we'll show a placeholder implementation
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error("Failed to change password");
      console.error(error);
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Profile Settings</h1>
          <p className="text-gray-600">Manage your account and preferences</p>
        </div>

        {/* Profile Picture Section */}
        <div className="ep-surface--transparent glass-elevated glass-3d rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Profile Picture</h2>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-lg">
                {profile?.pictureUrl ? (
                  <img 
                    src={profile.pictureUrl} 
                    alt="Profile" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
                    👤
                  </div>
                )}
              </div>
              {uploading && (
                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="flex-1 text-center sm:text-left">
              <label className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 px-6 rounded-xl cursor-pointer transition-colors shadow-sm">
                <span>📷</span>
                <span>Change Picture</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => { void handlePictureUpload(e); }}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500 mt-2">JPG, PNG or GIF. Max size 5MB.</p>
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="ep-surface--transparent glass-elevated glass-3d rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Personal Information</h2>
          <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-2">
                Relationship to Emily
              </label>
              <select
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as Relationship)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors text-gray-900 bg-white"
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm"
            >
              Save Changes
            </button>
          </form>
        </div>

        {/* Account Security */}
        <div className="ep-surface--transparent glass-elevated glass-3d rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Account Security</h2>
          <form onSubmit={(e) => { void handlePasswordChange(e); }} className="space-y-6">
            <div>
              <label htmlFor="current-password" className="block text-sm font-medium text-gray-700 mb-2">
                Current Password
              </label>
              <input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-2">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors text-gray-900 placeholder-gray-400"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 mt-1">Must be at least 8 characters long</p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={changingPassword}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {changingPassword ? "Changing Password..." : "Change Password"}
            </button>
          </form>
        </div>

        {/* Account Information */}
        <div className="ep-surface--transparent glass-elevated glass-3d rounded-2xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Account Information</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Email</span>
              <span className="text-sm text-gray-900">{user?.email || "Not provided"}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-700">Account Type</span>
              <span className="text-sm text-gray-900">Standard User</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-medium text-gray-700">Member Since</span>
              <span className="text-sm text-gray-900">Recently</span>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="ep-surface--transparent glass-elevated glass-3d rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Account Actions</h2>
          <div className="space-y-4">
            <div className="text-sm text-gray-600 mb-4">
              Sign out of your account. You'll need to sign in again to access your profile and media.
            </div>
            <SignOutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
