import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import "./styles/overlay.css";
import App from "./App";
import { VideoProvider } from "./components/VideoContext";

let convex: any = null;
try {
  // If VITE_CONVEX_URL is missing this may still work with default behavior, but guard runtime errors
  const convexUrl = (import.meta.env.VITE_CONVEX_URL as string) ?? "";
  convex = new ConvexReactClient(convexUrl);
} catch (e: any) {
  // render a visible error to the page to avoid blank screen
  const root = document.getElementById("root");
  if (root) {
    root.innerText = `App initialization error: ${e?.message ?? String(e)}`;
  }
}

if (convex) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ConvexAuthProvider client={convex}>
        <VideoProvider>
          <App />
        </VideoProvider>
      </ConvexAuthProvider>
    </StrictMode>,
  );
}
