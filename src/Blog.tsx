import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Comments } from "./components/Comments";

export default function Blog() {
  const posts = useQuery(api.posts.list);
  const createPost = useMutation(api.posts.create);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
    ],
    content: "",
  });

  const addImage = useCallback(async (file: File) => {
    if (!editor) return;
    
    try {
      setUploading(true);
      const postUrl = await generateUploadUrl();
      const result = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const { storageId } = await result.json();
      
      // Get the URL for the uploaded image
      const items = await fetch(`/convex-url/${storageId}`).then(r => r.json());
      const url = items.url;
      
      // Add image to editor
      editor.chain().focus().setImage({ src: url }).run();
    } finally {
      setUploading(false);
    }
  }, [editor, generateUploadUrl]);
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title || !editor?.getJSON()) return;
    
    const json = editor.getJSON();
    await createPost({ 
      title, 
      content: {
        type: "doc",
        content: json.content || [],
      }
    });
    setTitle("");
    editor.commands.setContent("");
  }
  
  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-emerald-800 mb-8">Memories</h1>
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          Please complete your profile to view and share memories.
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-emerald-800 mb-8">Memories</h1>
      
      <form onSubmit={handleSubmit} className="mb-12 space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-2 border rounded"
        />
        <div className="border rounded p-2">
          <div className="border-b pb-2 mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-2 rounded ${editor?.isActive('bold') ? 'bg-gray-200' : ''}`}
            >
              Bold
            </button>
            <button
              type="button"
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-2 rounded ${editor?.isActive('italic') ? 'bg-gray-200' : ''}`}
            >
              Italic
            </button>
            <label className="p-2 rounded bg-emerald-600 text-white cursor-pointer">
              Add Image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addImage(file);
                }}
                className="hidden"
                disabled={uploading}
              />
            </label>
          </div>
          <EditorContent editor={editor} className="min-h-[200px] prose max-w-none" />
        </div>
        <button
          type="submit"
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
          disabled={!title || !editor?.getHTML()}
        >
          Share Memory
        </button>
      </form>
      
      <div className="space-y-8">
        {posts?.map((post) => (
          <PostCard key={post._id} post={post} />
        ))}
      </div>
    </div>
  );
}

function PostCard({ post }: { post: any }) {
  const profile = useQuery(api.profiles.get, { userId: post.authorId });
  
  return (
    <article className="border rounded-lg p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {profile?.pictureUrl ? (
            <img 
              src={profile.pictureUrl} 
              alt="Author" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              ?
            </div>
          )}
        </div>
        <div>
          <div className="text-sm font-medium">{profile?.name ?? "Anonymous"}</div>
          <div className="text-sm text-gray-600">
            {profile?.relationship ?? "Friend"} of Emily
          </div>
          <time className="text-sm text-gray-500">
            {new Date(post.createdAt).toLocaleDateString()}
          </time>
        </div>
      </div>
      <h2 className="text-2xl font-bold mb-2">{post.title}</h2>
      <div 
        className="prose text-gray-600"
        dangerouslySetInnerHTML={{ 
          __html: post.content.content
            .map((node: any) => {
              if (node.type === 'paragraph') {
                return `<p>${node.content?.map((c: any) => {
                  if (c.type === 'text') return c.text;
                  if (c.type === 'image') return `<img src="${c.attrs.src}" alt="${c.attrs.alt || ''}" />`;
                  return '';
                }).join('')}</p>`;
              }
              return '';
            })
            .join('')
        }}
      />

      <Comments targetType="post" targetId={post._id} />
    </article>
  );
}
