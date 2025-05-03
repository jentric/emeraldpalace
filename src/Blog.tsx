import { usePaginatedQuery, useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState, useCallback, useMemo } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Comments } from "./components/Comments";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

function MenuBar({ editor }: { editor: any }) {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b p-2 flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("bold") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("italic") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        italic
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("strike") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        strike
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("paragraph") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        paragraph
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("heading", { level: 1 }) ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        h1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("heading", { level: 2 }) ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        h2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("heading", { level: 3 }) ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        h3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("bulletList") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        bullet list
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("orderedList") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        ordered list
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`px-2 py-1 rounded ${
          editor.isActive("blockquote") ? "bg-emerald-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        blockquote
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().chain().focus().undo().run()}
        className="px-2 py-1 rounded hover:bg-gray-100"
      >
        undo
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().chain().focus().redo().run()}
        className="px-2 py-1 rounded hover:bg-gray-100"
      >
        redo
      </button>
    </div>
  );
}

function PostContent({ content }: { content: any }) {
  const editor = useEditor({
    extensions: [StarterKit, Image],
    content,
    editable: false,
  });
  return <EditorContent editor={editor} />;
}

function AuthorInfo({ userId }: { userId: Id<"users"> }) {
  const profile = useQuery(api.profiles.get, { userId });
  
  if (!profile) return null;
  
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100">
        {profile.pictureUrl ? (
          <img 
            src={profile.pictureUrl} 
            alt={profile.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            ?
          </div>
        )}
      </div>
      <div>
        <div className="font-medium">{profile.name}</div>
        <div className="text-sm text-gray-500">{profile.relationship} of Emily</div>
      </div>
    </div>
  );
}

export default function Blog() {
  const { results: posts, status, loadMore } = usePaginatedQuery(
    api.posts.list,
    { paginationOpts: { numItems: 20 } },
    { initialNumItems: 20 }
  );
  const createPost = useMutation(api.posts.create);
  const deletePost = useMutation(api.posts.remove);
  const generateUploadUrl = useMutation(api.media.generateUploadUrl);
  const profile = useQuery(api.profiles.getCurrentProfile);
  const user = useQuery(api.auth.loggedInUser);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content: "",
  });

  const addImage = useCallback(
    async (file: File) => {
      if (!editor) return;

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
        const url = await fetch(`/api/storage/${storageId}`).then((r) => r.text());
        editor.chain().focus().setImage({ src: url }).run();
      } catch (error) {
        console.error("Failed to upload image:", error);
        toast.error("Failed to upload image");
      } finally {
        setUploading(false);
      }
    },
    [editor, generateUploadUrl]
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer?.files[0];
      if (file && file.type.startsWith("image/")) {
        addImage(file);
      }
    },
    [addImage]
  );

  const handlePaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      const file = event.clipboardData?.files[0];
      if (file && file.type.startsWith("image/")) {
        event.preventDefault();
        addImage(file);
      }
    },
    [addImage]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editor || !title.trim()) return;

    try {
      const content = editor.getJSON();
      await createPost({
        title,
        content: {
          type: "doc",
          content: content.content || [],
        },
      });
      setTitle("");
      editor.commands.setContent("");
      toast.success("Post created successfully!");
    } catch (error) {
      toast.error("Failed to create post");
      console.error(error);
    }
  }

  async function handleDelete(postId: Id<"posts">) {
    if (!confirm("Are you sure you want to delete this post?")) return;
    
    try {
      await deletePost({ id: postId });
      toast.success("Post deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete post");
      console.error(error);
    }
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

      <div className="mb-12 space-y-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full p-2 border rounded text-lg"
          required
        />
        <div className="border rounded overflow-hidden">
          <MenuBar editor={editor} />
          <div
            className="relative"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onPaste={handlePaste}
          >
            {uploading && (
              <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                Uploading image...
              </div>
            )}
            <EditorContent editor={editor} className="prose max-w-none p-4" />
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flex justify-end gap-4">
          <button
            type="submit"
            disabled={!title.trim() || !editor?.getText().trim()}
            className="bg-emerald-600 text-white px-6 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            Share Memory
          </button>
        </form>
      </div>

      <div className="space-y-8">
        {posts?.map((post) => (
          <article key={post._id} className="border rounded-lg overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <div className="flex justify-between items-start mb-4">
                <AuthorInfo userId={post.authorId} />
                {post.authorId === user?._id && (
                  <button
                    type="button"
                    onClick={() => handleDelete(post._id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    Delete
                  </button>
                )}
              </div>
              <h2 className="text-xl font-semibold">{post.title}</h2>
              <div className="text-sm text-gray-500 mt-1">
                {new Date(post.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="prose max-w-none p-4">
              <PostContent content={post.content} />
            </div>
            <div className="border-t">
              <Comments targetType="post" targetId={post._id} />
            </div>
          </article>
        ))}
      </div>

      {status === "CanLoadMore" && (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => loadMore(20)}
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
    </div>
  );
}
