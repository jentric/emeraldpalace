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

// Service Worker registration (optional). Registers public/sw.js if supported.
// Defer registration until window load to avoid interfering with dev tooling
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        // Log success
        // eslint-disable-next-line no-console
        console.debug("[SW] registered", reg);

        // Listen for updates to the SW and attempt to activate immediately when requested by the SW
        if (reg.waiting) {
          try { reg.waiting.postMessage("skipWaiting"); } catch { /* no-op */ }
        }
        reg.addEventListener("updatefound", () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener("statechange", () => {
            if (nw.state === "installed" && navigator.serviceWorker.controller) {
              // New content available; try to activate immediately
              try { reg.waiting?.postMessage("skipWaiting"); } catch { /* no-op */ }
            }
          });
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.debug("[SW] registration failed", err);
      }
    })();
  });
}
