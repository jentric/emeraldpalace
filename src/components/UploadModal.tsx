import React, { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function UploadModal({ isOpen, onClose }: Props) {
  const generateUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const type: "image" | "video" | null = useMemo(() => {
    if (!file) return null;
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return null;
  }, [file]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !type || !title) return;
    setSubmitting(true);
    try {
      const url = await generateUrl({});
      const res = await fetch(url, { method: "POST", body: file });
      const { storageId } = await res.json();
      await createMedia({
        title,
        caption: caption || undefined,
        type,
        storageId,
        visibleTo: [],
        category: undefined,
      });
      onClose();
      setFile(null);
      setTitle("");
      setCaption("");
    } catch (err) {
      console.error("upload failed", err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="bg-white/95 rounded-2xl border border-black/20 shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="upload-title" className="text-lg font-semibold">Upload</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center" aria-label="Close upload modal">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="upload-file" className="block text-sm font-medium mb-2">Select file</label>
            <input id="upload-file" type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <div>
            <label htmlFor="upload-title-input" className="block text-sm font-medium mb-2">Title</label>
            <input id="upload-title-input" className="w-full p-3 border border-black/30 rounded-xl bg-white/60" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <label htmlFor="upload-caption-input" className="block text-sm font-medium mb-2">Caption (optional)</label>
            <textarea id="upload-caption-input" className="w-full p-3 border border-black/30 rounded-xl bg-white/60" rows={3} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </div>
          <div className="text-xs opacity-70">The upload will be attributed to your account.</div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-black/30 rounded-xl bg-white/50 hover:bg-white/70">Cancel</button>
            <button type="submit" disabled={!file || !type || !title || submitting} className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50">{submitting ? "Uploading…" : "Upload"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


