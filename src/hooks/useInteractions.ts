import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export interface InteractionSnapshot {
  likeCount: number;
  saveCount: number;
  liked: boolean;
  saved: boolean;
}

export function useInteractions(mediaIds: Id<"mediaItems">[]) {
  const [map, setMap] = useState<Record<string, InteractionSnapshot>>({});
  const countsMany = useQuery(api.interactions.countsMany, mediaIds.length ? { mediaIds } : "skip");
  const toggleLike = useMutation(api.interactions.toggleLike);
  const toggleSave = useMutation(api.interactions.toggleSave);

  // merge server counts
  useEffect(() => {
    if (!countsMany) return;
    setMap(prev => {
      let changed = false; const next = { ...prev };
      countsMany.forEach((c: any) => {
        const e = prev[c.mediaId];
        if (!e || e.likeCount !== c.likeCount || e.saveCount !== c.saveCount || e.liked !== c.liked || e.saved !== c.saved) {
          next[c.mediaId] = { likeCount: c.likeCount, saveCount: c.saveCount, liked: c.liked, saved: c.saved };
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [countsMany]);

  function optimisticLike(id: Id<"mediaItems">) {
    const snap = map[id];
    if (!snap) return;
    const updated: InteractionSnapshot = { ...snap, liked: !snap.liked, likeCount: snap.likeCount + (snap.liked ? -1 : 1) };
    setMap(prev => ({ ...prev, [id]: updated }));
    void toggleLike({ mediaId: id }).catch(() => setMap(prev => ({ ...prev, [id]: snap })));
  }

  function optimisticSave(id: Id<"mediaItems">) {
    const snap = map[id];
    if (!snap) return;
    const updated: InteractionSnapshot = { ...snap, saved: !snap.saved, saveCount: snap.saveCount + (snap.saved ? -1 : 1) };
    setMap(prev => ({ ...prev, [id]: updated }));
    void toggleSave({ mediaId: id }).catch(() => setMap(prev => ({ ...prev, [id]: snap })));
  }

  return { interactionMap: map, optimisticLike, optimisticSave, countsLoading: !countsMany && mediaIds.length > 0 };
}
