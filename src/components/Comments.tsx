import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

function AuthorInfo({ userId }: { userId: Id<"users"> }) {
  const profile = useQuery(api.profiles.get, { userId });
  
  if (!profile) return null;
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100">
        {profile.pictureUrl ? (
          <img 
            src={profile.pictureUrl} 
            alt={profile.name} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            ?
          </div>
        )}
      </div>
      <div className="font-medium text-sm">{profile.name}</div>
    </div>
  );
}

export function Comments({ 
  targetType,
  targetId,
}: { 
  targetType: "post" | "media";
  targetId: Id<"posts"> | Id<"mediaItems">;
}) {
  const comments = useQuery(api.comments.list, { targetType, targetId });
  const createComment = useMutation(api.comments.create);
  const deleteComment = useMutation(api.comments.remove);
  const user = useQuery(api.auth.loggedInUser);
  const [content, setContent] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    try {
      await createComment({
        content,
        targetType,
        targetId,
      });
      setContent("");
    } catch (error) {
      toast.error("Failed to post comment");
      console.error(error);
    }
  }

  async function handleDelete(commentId: Id<"comments">) {
    try {
      await deleteComment({ id: commentId });
      toast.success("Comment deleted");
    } catch (error) {
      toast.error("Failed to delete comment");
      console.error(error);
    }
  }

  if (!comments) return null;

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium">Comments</h3>
      
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment._id} className="flex items-start gap-2">
            <AuthorInfo userId={comment.authorId} />
            <div className="flex-1 bg-gray-50 rounded-lg p-2 text-sm relative group">
              {comment.content}
              {comment.authorId === user?._id && (
                <button
                  onClick={() => handleDelete(comment._id)}
                  className="absolute top-2 right-2 text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete comment"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 p-2 border rounded"
        />
        <button
          type="submit"
          disabled={!content.trim()}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          Post
        </button>
      </form>
    </div>
  );
}
