import React, { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Very small rich-text: allow bold/italic/links and paragraphs using contenteditable → serialize to a minimal ProseMirror-like doc
function serializeContent(el: HTMLDivElement): any {
  const blocks: any[] = [];
  el.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const text = (n as Text).data.trim();
      if (text) blocks.push({ type: "paragraph", content: [{ type: "text", text }] });
      return;
    }
    if (n.nodeType === Node.ELEMENT_NODE) {
      const e = n as HTMLElement;
      if (e.tagName === "P") {
        const parts: any[] = [];
        e.childNodes.forEach((cn) => {
          if (cn.nodeType === Node.TEXT_NODE) {
            const t = (cn as Text).data;
            if (t) parts.push({ type: "text", text: t });
          } else if (cn.nodeType === Node.ELEMENT_NODE) {
            const ce = cn as HTMLElement;
            if (ce.tagName === "B" || ce.tagName === "STRONG") parts.push({ type: "text", text: ce.innerText, marks: [{ type: "bold" }] });
            else if (ce.tagName === "I" || ce.tagName === "EM") parts.push({ type: "text", text: ce.innerText, marks: [{ type: "italic" }] });
            else if (ce.tagName === "A") parts.push({ type: "text", text: ce.innerText, marks: [{ type: "link", href: ce.getAttribute("href") }] });
          }
        });
        blocks.push({ type: "paragraph", content: parts.length ? parts : [{ type: "text", text: "" }] });
      }
    }
  });
  return { type: "doc", content: blocks.length ? blocks : [{ type: "paragraph", content: [{ type: "text", text: "" }] }] };
}

export default function PostModal({ isOpen, onClose }: Props) {
  const createPost = useMutation(api.posts.create);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const editor = document.getElementById("post-editor") as HTMLDivElement | null;
    if (!editor) return;
    const content = serializeContent(editor);
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await createPost({ title: title.trim(), content });
      onClose();
      setTitle("");
      if (editor) editor.innerHTML = "<p></p>";
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="post-title">
      <div className="bg-white/95 rounded-2xl border border-black/20 shadow-2xl w-full max-w-2xl mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 id="post-title" className="text-lg font-semibold">New Post</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-black/10 hover:bg-black/20 flex items-center justify-center" aria-label="Close post modal">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="post-title-input" className="block text-sm font-medium mb-2">Title</label>
            <input id="post-title-input" className="w-full p-3 border border-black/30 rounded-xl bg-white/60" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Give your post a title" required />
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs mb-2 opacity-80">
              <span>Formatting:</span>
              <span><b>B</b> bold</span>
              <span><i>I</i> italic</span>
              <span>Paste links</span>
            </div>
            <div id="post-editor" className="w-full min-h-[160px] p-3 border border-black/30 rounded-xl bg-white/60" contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"><p></p></div>
          </div>
          <div className="text-xs opacity-70">This post will be attributed to your account.</div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-black/30 rounded-xl bg-white/50 hover:bg-white/70">Cancel</button>
            <button type="submit" disabled={!title.trim() || submitting} className="flex-1 px-4 py-2 bg-black text-white rounded-xl hover:bg-gray-800 disabled:opacity-50">{submitting ? "Posting…" : "Post"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


