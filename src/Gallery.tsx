import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { useInteractions } from "./hooks/useInteractions";
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
  category?: string;
};

type MediaItem = {
  _id: Id<"mediaItems">;
  title?: string;
  caption?: string;
  url?: string | null;
  type: "image" | "video";
  authorId?: string | Id<"profiles">;
  visibleTo?: Relationship[] | readonly Relationship[];
  category?: string;
};


function InlineEditor({ item, onSave, onCancel }: { item: MediaItem; onSave: (title: string, caption?: string, visibleTo?: Relationship[], category?: string) => Promise<void> | void; onCancel?: () => void; }) {
  const [title, setTitle] = useState(item.title || "");
  const [caption, setCaption] = useState(item.caption || "");
  const [visibleTo, setVisibleTo] = useState<Relationship[]>(item.visibleTo ? Array.from(item.visibleTo) : [...relationshipTypes]);
  const [category, setCategory] = useState<string | undefined>(item.category);
  const [working, setWorking] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void (async () => {
          if (!title.trim()) {
            toast.error("Title is required");
            return;
          }
          setWorking(true);
          try {
            await onSave(title.trim(), caption.trim() || undefined, visibleTo, category);
          } finally {
            setWorking(false);
          }
        })();
      }}
      className="space-y-2"
    >
      <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-2 border rounded" placeholder="Title" />
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-2 border rounded" placeholder="Caption (optional)" />
      <div className="flex flex-wrap gap-2">
        {relationshipTypes.map(r => (
          <label key={r} className={`text-xs px-2 py-1 rounded-full border ${visibleTo.includes(r) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700'}`}>
            <input className="mr-1" type="checkbox" checked={visibleTo.includes(r)} onChange={(e) => setVisibleTo(prev => e.target.checked ? [...prev, r] : prev.filter(p => p !== r))} />
            {r}
          </label>
        ))}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
  <select aria-label="Category" value={category || ''} onChange={e => setCategory(e.target.value || undefined)} className="w-full p-2 border rounded text-sm">
          <option value="">None</option>
          {['Special Moments','Adventures','Everyday Elegance','Passions','The Simple Life'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={working} className="px-3 py-1 bg-emerald-600 text-white rounded">{working ? 'Saving...' : 'Save'}</button>
        <button type="button" onClick={() => onCancel && onCancel()} className="px-3 py-1 bg-gray-100 rounded">Cancel</button>
      </div>
    </form>
  );
}

export default function Gallery() {
  const profile = useQuery(api.profiles.getCurrentProfile);
  const categoryTabs = ['Special Moments','Adventures','Everyday Elegance','Passions','The Simple Life'] as const;
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { results: media, status, loadMore } = usePaginatedQuery(
    api.media.list,
    profile ? {} as any : "skip",
    { initialNumItems: 15 }
  );
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const createMedia = useMutation(api.media.create);
  const deleteMedia = useMutation(api.media.remove);
  const updateMedia = useMutation(api.media.update);
  const user = useQuery(api.auth.loggedInUser);

  const [uploading, setUploading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedRelationships, setSelectedRelationships] = useState<Relationship[]>(() => {
    try {
      const raw = localStorage.getItem("ep:selectedRelationships");
      return raw ? (JSON.parse(raw) as Relationship[]) : [...relationshipTypes];
    } catch {
      return [...relationshipTypes];
    }
  });
  const [layoutMasonry, setLayoutMasonry] = useState<boolean>(() => {
    try { return localStorage.getItem("ep:layoutMasonry") !== "false"; } catch { return true; }
  });
  const [uploadState, setUploadState] = useState<UploadState>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaItem[] | null>(null);
  const mediaIds = (localMedia ?? media ?? []).map(m => m._id);
  const { interactionMap, optimisticLike, optimisticSave, countsLoading } = useInteractions(mediaIds as any);

  // video autoplay
  const videoObserverRef = useRef<IntersectionObserver | null>(null);
  // Per-video buffering state and cleanup registry
  const [bufferingMap, setBufferingMap] = useState<Record<string, boolean>>({});
  const cleanupRef = useRef<Record<string, () => void>>({});
  const [unmuted, setUnmuted] = useState<Record<string, boolean>>({});
  const unmutedRef = useRef(unmuted);
  useEffect(() => { unmutedRef.current = unmuted; }, [unmuted]);

  useEffect(() => {
    videoObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target as HTMLVideoElement;
        if (!el) return;
        const id = el.dataset.mediaId;
        if (entry.isIntersecting) {
          el.muted = !(id && unmutedRef.current[id]);
          void el.play().catch(() => {});
        } else {
          el.pause();
        }
      });
    }, { threshold: 0.5 });
    return () => videoObserverRef.current?.disconnect();
  }, []);

  // infinite scroll sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    if (status !== "CanLoadMore") return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => { if (entry.isIntersecting) loadMore(15); });
    }, { rootMargin: '400px 0px 0px 0px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, loadMore]);

  // mirror paginated media into local state
  useEffect(() => { if (media) setLocalMedia(media.slice()); }, [media]);
  useEffect(() => {
    return () => {
      // cleanup any attached listeners on unmount
      try { Object.values(cleanupRef.current).forEach(fn => fn()); } catch { /* no-op */ }
      cleanupRef.current = {};
    };
  }, []);

  // counts merged via useInteractions

  useEffect(() => {
    try { localStorage.setItem('ep:selectedRelationships', JSON.stringify(selectedRelationships)); } catch { void 0; }
  }, [selectedRelationships]);

  useEffect(() => {
    try { localStorage.setItem('ep:layoutMasonry', layoutMasonry ? 'true' : 'false'); } catch { void 0; }
  }, [layoutMasonry]);

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadState({ file, title: file.name, visibleTo: [...relationshipTypes] });
  }

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!uploadState) return;
    try {
      setUploading(true);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: 'POST',
        headers: { 'Content-Type': uploadState.file.type },
        body: uploadState.file,
      });
      if (!result.ok) throw new Error('upload failed');
      const { storageId } = await result.json();
  await createMedia({ title: uploadState.title, caption: uploadState.caption || '', type: uploadState.file.type.startsWith('image/') ? 'image' : 'video', storageId, visibleTo: uploadState.visibleTo, category: uploadState.category as any });
      toast.success('Uploaded');
      setUploadState(null);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed');
    } finally { setUploading(false); }
  }

  async function handleDelete(id: Id<"mediaItems">) {
    if (!confirm('Delete this item?')) return;
    try {
  await deleteMedia({ id });
      setLocalMedia(prev => prev ? prev.filter(m => m._id !== id) : prev);
      toast.success('Deleted');
    } catch (err) {
      console.error(err);
      toast.error('Delete failed');
    }
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-emerald-800 mb-6">Photographs & Videos</h1>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">Please complete your profile to view and share media.</div>
      </div>
    );
  }

  const baseList = localMedia ?? media ?? [];
  const list = activeCategory ? baseList.filter(m => m.category === activeCategory) : baseList;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-emerald-800 mb-2">Photographs & Videos</h1>
      <div className="mb-4 flex flex-wrap gap-2">
        {categoryTabs.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(c => c === cat ? null : cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${activeCategory === cat ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200'}`}>{cat}</button>
        ))}
        {activeCategory && <button onClick={() => setActiveCategory(null)} className="px-2 py-1 rounded-full text-xs bg-gray-100 hover:bg-gray-200">Clear</button>}
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        {relationshipTypes.map(r => (
          <button key={r} onClick={() => setSelectedRelationships(prev => prev.includes(r) ? prev.filter(p => p !== r) : [...prev, r])} className={`text-xs px-2 py-1 rounded-full border transition ${selectedRelationships.includes(r) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 hover:bg-emerald-50 border-emerald-200'}`}>
            {r}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs text-gray-500">Layout</label>
          <button onClick={() => setLayoutMasonry(prev => { const next = !prev; try { localStorage.setItem('ep:layoutMasonry', next ? 'true' : 'false'); } catch { void 0; } return next; })} className="text-xs px-2 py-1 rounded-full bg-white border" title="Toggle layout">{layoutMasonry ? 'Masonry' : 'Grid'}</button>
        </div>
        {selectedRelationships.length !== relationshipTypes.length && <button onClick={() => setSelectedRelationships([...relationshipTypes])} className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Reset</button>}
      </div>

      <div className={layoutMasonry ? '[column-fill:_balance] columns-1 sm:columns-2 lg:columns-3 gap-4' : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'} aria-live="polite">
        {uploadState ? (
          <form onSubmit={(e) => { e.preventDefault(); void handleUpload(e); }} className="mb-4 break-inside-avoid p-4 bg-white/70 backdrop-blur rounded-lg border border-emerald-100 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <input type="text" value={uploadState.title} onChange={(e) => setUploadState({ ...uploadState, title: e.target.value })} className="flex-1 text-sm p-2 border rounded" required placeholder="Title" />
              <button type="button" onClick={() => setUploadState(null)} className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200">Cancel</button>
            </div>
            <input type="text" value={uploadState.caption || ''} onChange={(e) => setUploadState({ ...uploadState, caption: e.target.value })} className="text-sm p-2 border rounded" placeholder="Caption (optional)" />
            <div className="flex flex-wrap gap-1">
              {relationshipTypes.map(type => (
                <label key={type} className="text-[10px] px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 cursor-pointer flex items-center gap-1">
                  <input type="checkbox" checked={uploadState.visibleTo.includes(type)} onChange={(e) => { const newVisibleTo = e.target.checked ? [...uploadState.visibleTo, type] : uploadState.visibleTo.filter((t) => t !== type); setUploadState({ ...uploadState, visibleTo: newVisibleTo }); }} className="scale-75" />
                  {type}
                </label>
              ))}
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-600 mb-1">Category</label>
              <select aria-label="Category" value={uploadState.category || ''} onChange={e => setUploadState({ ...uploadState, category: e.target.value || undefined })} className="w-full p-2 border rounded text-sm">
                <option value="">None</option>
                {categoryTabs.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" disabled={uploading} className="w-full text-sm py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">{uploading ? 'Uploading...' : 'Upload'}</button>
          </form>
        ) : (
          <label className="mb-4 break-inside-avoid block p-8 rounded-lg border-2 border-dashed border-emerald-200 hover:border-emerald-400 text-center cursor-pointer bg-white/60 backdrop-blur-sm text-sm text-emerald-700 shadow-sm hover:shadow transition group">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                <span className="text-2xl">📷</span>
              </div>
              <div>
                <div className="font-medium text-lg">Share a photo or video</div>
                <div className="text-xs text-emerald-600 mt-1">Click to upload or drag and drop</div>
              </div>
            </div>
            <input type="file" accept="image/*,video/*" onChange={(e) => { void handleFileSelect(e); }} className="hidden" />
          </label>
        )}

        {list.map((item, index) => {
          const itemVisibleTo: string[] = Array.isArray(item.visibleTo) ? item.visibleTo : relationshipTypes as unknown as string[];
          const visible = itemVisibleTo.some((v: string) => selectedRelationships.includes(v as Relationship));
          if (!visible) return null;
          const inter = interactionMap[item._id];
          return (
            <div key={item._id} className="relative group mb-4 break-inside-avoid rounded-lg overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition cursor-pointer" onClick={() => setSelectedIndex(index)}>
              {item.type === 'image' ? (
                <img src={item.url || undefined} alt={item.title} loading="lazy" className="w-full h-auto object-cover block transition-transform duration-300 group-hover:scale-[1.02]" />
              ) : (
                <div className="relative">
                  <video
                    data-media-id={item._id}
                    ref={(el) => {
                      const id = String(item._id);
                      // If element is null (unmount), run existing cleanup for this id
                      if (!el) {
                        try { cleanupRef.current[id]?.(); } catch { /* no-op */ }
                        delete cleanupRef.current[id];
                        return;
                      }
                      // assign dataset + muted + observe
                      el.dataset.mediaId = item._id;
                      el.muted = !(unmuted[item._id] || false);
                      videoObserverRef.current?.observe(el);

                      // remove any previous handlers for this id before attaching new ones
                      try { cleanupRef.current[id]?.(); } catch { /* no-op */ }

                      const onWaiting = () => setBufferingMap(prev => ({ ...(prev || {}), [id]: true }));
                      const onPlaying = () => setBufferingMap(prev => ({ ...(prev || {}), [id]: false }));

                      el.addEventListener("waiting", onWaiting);
                      el.addEventListener("playing", onPlaying);
                      el.addEventListener("canplay", onPlaying);
                      el.addEventListener("canplaythrough", onPlaying);

                      cleanupRef.current[id] = () => {
                        try {
                          el.removeEventListener("waiting", onWaiting);
                          el.removeEventListener("playing", onPlaying);
                          el.removeEventListener("canplay", onPlaying);
                          el.removeEventListener("canplaythrough", onPlaying);
                        } catch { /* no-op */ }
                        delete cleanupRef.current[id];
                      };
                    }}
                    src={item.url || undefined}
                    preload="metadata"
                    className="w-full h-auto object-cover block"
                    playsInline
                  />
                  {/* Buffering spinner for this thumbnail */}
                  {bufferingMap[String(item._id)] && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-8 h-8 border-3 border-white/80 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <button onClick={(e: MouseEvent) => { e.stopPropagation(); const id = String(item._id); setUnmuted(prev => { const next: Record<string, boolean> = { ...(prev || {}), [id]: !(prev?.[id] || false) }; const vids = document.querySelectorAll(`video[data-media-id="${id}"]`); vids.forEach(v => { (v as HTMLVideoElement).muted = !next[id]; }); return next; }); }} className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/80 flex items-center justify-center text-sm" title={unmuted[String(item._id)] ? 'Mute' : 'Unmute'}>{unmuted[String(item._id)] ? '🔊' : '🔇'}</button>
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity" />
              {(item.caption || item.title) && (
                <div className="absolute bottom-0 left-0 right-0 p-2 text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="font-medium truncate">{item.title}</div>
                  {item.caption && <div className="text-[10px] max-h-8 overflow-hidden">{item.caption}</div>}
                </div>
              )}

              {(inter || countsLoading) && (
                <div className="absolute top-2 left-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {inter ? (
                    <button onClick={(e: MouseEvent) => { e.stopPropagation(); optimisticLike(item._id as any); }} className={`px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur bg-black/50 hover:brightness-110 ${inter.liked ? 'text-emerald-200' : 'text-white/80'}`}>❤️ {inter.likeCount}</button>
                  ) : (
                    <div className="px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur bg-black/40 text-white/60 skeleton w-14 h-6" />
                  )}
                  {inter ? (
                    <button onClick={(e: MouseEvent) => { e.stopPropagation(); optimisticSave(item._id as any); }} className={`px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur bg-black/50 hover:brightness-110 ${inter.saved ? 'text-red-200' : 'text-white/80'}`}>💾 {inter.saveCount}</button>
                  ) : (
                    <div className="px-2 py-1 rounded-full text-[10px] font-medium backdrop-blur bg-black/40 text-white/60 skeleton w-14 h-6" />
                  )}
                </div>
              )}

              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {item.authorId === user?._id && (
                  <button onClick={(e: MouseEvent) => { e.stopPropagation(); void handleDelete(item._id); setLocalMedia(prev => prev ? prev.filter(m => m._id !== item._id) : prev); }} className="w-8 h-8 rounded-full bg-red-600/80 text-white flex items-center justify-center text-lg leading-none hover:bg-red-600" title="Delete">×</button>
                )}
                {item.authorId === user?._id && (
                  <button onClick={(e: MouseEvent) => { e.stopPropagation(); setUploadState(null); setSelectedIndex(index); }} className="w-8 h-8 rounded-full bg-white/90 text-emerald-700 flex items-center justify-center text-lg leading-none hover:bg-emerald-100" title="Edit">✎</button>
                )}
              </div>
            </div>
          );
        })}

        {status === 'LoadingMore' && <div className="mb-4 break-inside-avoid p-4 text-center text-sm text-emerald-700 bg-emerald-50 rounded">Loading…</div>}
      </div>

      <div ref={sentinelRef} className="h-2 w-full" />

      {list.length === 0 && <div className="mt-8 text-center text-sm text-gray-500">No media yet. Be the first to add something special.</div>}

  {selectedIndex !== null && list[selectedIndex] && (
        <FullscreenMediaModal
          item={list[selectedIndex] as any}
          onClose={() => setSelectedIndex(null)}
          canEdit={list[selectedIndex].authorId === user?._id}
          onDelete={async () => { if (selectedIndex === null) return; await handleDelete(list[selectedIndex]._id); setSelectedIndex(null); }}
          onSaveInline={async (title, caption, visibleTo, category) => {
            const snapshot = list.map(l => ({ ...l }));
            if (selectedIndex === null) return;
            setLocalMedia(prev => (prev || list).map(m => m._id === list[selectedIndex]._id ? { ...m, title, caption, visibleTo: visibleTo || m.visibleTo, category: category ?? m.category } : m));
            try {
              const resolvedVisible: Relationship[] = visibleTo ?? (Array.isArray(list[selectedIndex].visibleTo) ? Array.from(list[selectedIndex].visibleTo) : [...relationshipTypes]);
              await updateMedia({ id: list[selectedIndex]._id, title, caption: caption || '', visibleTo: resolvedVisible, category: category as any });
              toast.success('Saved');
            } catch (err) {
              console.error(err); toast.error('Save failed'); setLocalMedia(snapshot);
            }
          }}
          unmuted={!!unmuted[list[selectedIndex]._id]}
          toggleMute={() => { if (selectedIndex === null) return; const id = list[selectedIndex]._id; setUnmuted(prev => { const next = { ...(prev || {}), [id]: !(prev?.[id] || false) }; const vids = document.querySelectorAll(`video[data-media-id="${id}"]`); vids.forEach(v => { (v as HTMLVideoElement).muted = !next[id]; }); return next; }); }}
          currentIndex={selectedIndex}
          totalItems={list.length}
          onNavigate={(direction: 'next' | 'prev') => {
            if (selectedIndex === null) return;
            const newIndex = direction === 'next' 
              ? (selectedIndex + 1) % list.length 
              : (selectedIndex - 1 + list.length) % list.length;
            setSelectedIndex(newIndex);
          }}
        />
      )}
    </div>
  );
}

// --- Fullscreen modal component ---
function FullscreenMediaModal({ item, onClose, canEdit, onDelete, onSaveInline, unmuted, toggleMute, currentIndex, totalItems, onNavigate }: {
  item: MediaItem; onClose: () => void; canEdit: boolean; onDelete: () => void | Promise<void>;
  onSaveInline: (title: string, caption?: string, visibleTo?: Relationship[], category?: string) => void | Promise<void>;
  unmuted: boolean; toggleMute: () => void;
  currentIndex: number; totalItems: number; onNavigate: (direction: 'next' | 'prev') => void;
}) {
  const counts = useQuery(api.interactions.counts, item ? { mediaId: item._id } : "skip");
  const toggleLike = useMutation(api.interactions.toggleLike);
  const toggleSave = useMutation(api.interactions.toggleSave);
  const [showEdit, setShowEdit] = useState(false);
  const [optimistic, setOptimistic] = useState<{ liked?: boolean; saved?: boolean; likeCountDelta: number; saveCountDelta: number }>({ likeCountDelta: 0, saveCountDelta: 0 });

  // Touch/swipe handling
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onNavigate('next');
    } else if (isRightSwipe) {
      onNavigate('prev');
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          onNavigate('prev');
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          onNavigate('next');
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case ' ':
        case 'Enter':
          // Don't prevent default for space/enter as they might be used for other interactions
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onNavigate, onClose]);

  async function handleLike() {
    if (!item) return; const curr = counts?.liked || false; setOptimistic(o => ({ ...o, liked: !curr, likeCountDelta: o.likeCountDelta + (curr ? -1 : 1) }));
    try { await toggleLike({ mediaId: item._id }); } catch { setOptimistic(o => ({ ...o, liked: curr, likeCountDelta: o.likeCountDelta + (curr ? 1 : -1) })); }
  }
  async function handleSave() {
    if (!item) return; const curr = counts?.saved || false; setOptimistic(o => ({ ...o, saved: !curr, saveCountDelta: o.saveCountDelta + (curr ? -1 : 1) }));
    try { await toggleSave({ mediaId: item._id }); } catch { setOptimistic(o => ({ ...o, saved: curr, saveCountDelta: o.saveCountDelta + (curr ? 1 : -1) })); }
  }

  const likeActive = optimistic.liked ?? counts?.liked;
  const saveActive = optimistic.saved ?? counts?.saved;
  const likeCount = (counts?.likeCount ?? 0) + optimistic.likeCountDelta;
  const saveCount = (counts?.saveCount ?? 0) + optimistic.saveCountDelta;

  // Pinch/zoom: use CSS overscroll + gesture hint; we rely on browser native pinch to zoom image/video (object-contain) plus allow double click to toggle cover mode.
  const [cover, setCover] = useState(false);
  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col bg-black touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Navigation arrows */}
      {totalItems > 1 && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center text-2xl hover:bg-black/80 transition-colors z-20"
            aria-label="Previous media"
            title="Previous (←)"
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center text-2xl hover:bg-black/80 transition-colors z-20"
            aria-label="Next media"
            title="Next (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Close button */}
      <div className="absolute top-3 left-3 z-10 flex gap-2">
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-lg hover:bg-black" aria-label="Close">×</button>
      </div>

      {/* Position indicator */}
      {totalItems > 1 && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
          <div className="bg-black/60 text-white px-3 py-1 rounded-full text-sm">
            {currentIndex + 1} of {totalItems}
          </div>
        </div>
      )}

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="relative max-w-[min(100%,900px)] w-full">
          <div className="w-full aspect-[3/4] md:aspect-[4/3] bg-gray-100 rounded-2xl overflow-hidden flex items-center justify-center">
            {item.type === 'image' ? (
              <img onDoubleClick={() => setCover(c => !c)} src={item.url || undefined} alt={item.title} className={"max-w-full max-h-full transition-all duration-300 select-none " + (cover ? 'object-cover w-full h-full' : 'object-contain')} />
            ) : (
              <div className="relative w-full h-full flex items-center justify-center">
                <video onDoubleClick={() => setCover(c => !c)} data-media-id={item._id} src={item.url || undefined} controls className={"max-w-full max-h-full transition-all duration-300 " + (cover ? 'object-cover w-full h-full' : 'object-contain')} ref={(el) => { if (!el) return; el.muted = !unmuted; }} />
                <button onClick={toggleMute} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/80 flex items-center justify-center text-sm z-20 shadow" title={unmuted ? 'Mute' : 'Unmute'}>{unmuted ? '🔊' : '🔇'}</button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="relative bg-white rounded-t-2xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] shadow-lg translate-y-full animate-[slideUp_0.4s_ease_forwards] max-h-[calc(100vh-200px)] overflow-y-auto">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-2">
          <button onClick={(e) => { e.preventDefault(); void handleLike(); }} className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition ${likeActive ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>❤️ {likeCount}</button>
          <button onClick={(e) => { e.preventDefault(); void handleSave(); }} className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition ${saveActive ? 'bg-red-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>💾 {saveCount}</button>
          <a href="#comments" className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium bg-gray-100 hover:bg-gray-200 text-gray-700">💬 Comments</a>
          {canEdit && <button onClick={() => setShowEdit(s => !s)} className={`flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium transition ${showEdit ? 'bg-emerald-600 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}>✎ Edit</button>}
          {canEdit && <button onClick={() => { void onDelete(); }} className="flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium bg-red-600 text-white">Delete</button>}
          <div className="ml-auto text-xs text-gray-500 truncate max-w-[40%]">
            <strong className="font-medium text-gray-800 mr-1">{item.title}</strong>
            {item.caption}
          </div>
        </div>
        {showEdit && (
          <div className="border-t pt-3 mt-2">
            <InlineEditor item={item} onSave={async (t,c,v,cat) => { await onSaveInline(t,c,v,cat); setShowEdit(false); }} onCancel={() => setShowEdit(false)} />
          </div>
        )}
        <div id="comments" className="border-t mt-3 pt-3 -mx-4">
          <Comments targetType="media" targetId={item._id} />
        </div>
      </div>
    </div>
  );
}
