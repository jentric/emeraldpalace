import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";

type CommentsProps = {
  targetType: "post" | "media";
  targetId: Id<"posts"> | Id<"mediaItems">;
};

export function Comments({ targetType, targetId }: CommentsProps) {
  const comments = useQuery(api.comments.list, { targetType, targetId });
  const createComment = useMutation(api.comments.create);
  const [content, setContent] = useState("");
  const profile = useQuery(api.profiles.getCurrentProfile);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    await createComment({
      content,
      targetType,
      targetId,
    });
    setContent("");
  }

  return (
    <div className="mt-4 space-y-4">
      <h4 className="font-medium text-gray-900">Comments</h4>
      
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
          className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
        >
          Post
        </button>
      </form>

      <div className="space-y-4">
        {comments?.map((comment) => (
          <CommentCard key={comment._id} comment={comment} />
        ))}
      </div>
    </div>
  );
}

function CommentCard({ comment }: { comment: any }) {
  const profile = useQuery(api.profiles.get, { userId: comment.authorId });

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
        {profile?.pictureUrl ? (
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
        <div className="flex items-baseline gap-2">
          <span className="font-medium">{profile?.name ?? "Anonymous"}</span>
          <span className="text-sm text-gray-500">
            {new Date(comment.createdAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-gray-700 mt-1">{comment.content}</p>
      </div>
    </div>
  );
}
