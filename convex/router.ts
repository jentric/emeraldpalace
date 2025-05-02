import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Id } from "./_generated/dataModel";

const http = httpRouter();

http.route({
  path: "/storage/:id",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const id = url.pathname.split("/").pop() as Id<"_storage">;
    const storageUrl = await ctx.storage.getUrl(id);
    if (!storageUrl) {
      return new Response("File not found", { status: 404 });
    }
    return new Response(storageUrl);
  }),
});

export default http;
