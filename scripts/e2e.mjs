import puppeteer from "puppeteer";

const APP_URL = process.env.APP_URL || "http://localhost:5174";
const TIMEOUT_MS = 120000; // 2 minutes
const WAIT_PLAYING_MS = 60000; // wait up to 60s for playing

async function run() {
  console.log("E2E: launching puppeteer (headless)...");
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(60000);

    const seen = { manifest: false, segment: false };
    page.on("request", (req) => {
      try {
        const url = req.url();
        if (url.includes(".m3u8")) {
          seen.manifest = true;
          console.log("[E2E] manifest request:", url);
        }
        if (/seg[0-9]{3}\.ts/.test(url) || url.includes(".ts") || url.includes(".m4s")) {
          seen.segment = true;
          console.log("[E2E] segment request:", url);
        }
      } catch (e) { /* ignore */ }
    });

    page.on("console", async (msg) => {
      try {
        const text = msg.text();
        const args = [];
        // msg.args may not be a plain array in some puppeteer versions — handle defensively
        if (msg.args && typeof msg.args[Symbol.iterator] === "function") {
          for (const handle of msg.args) {
            try {
              // try to resolve JSHandle to a serializable value
              const val = await handle.jsonValue().catch(() => undefined);
              args.push(val !== undefined ? val : String(handle));
            } catch (e) {
              args.push(String(handle));
            }
          }
        }
        console.log("[PAGE]", text, ...args);
      } catch (e) {
        console.log("[PAGE] (console handler error)", e);
      }
    });

    console.log("E2E: navigating to", APP_URL);
    await page.goto(APP_URL, { waitUntil: "networkidle2" });

    // Wait for background video element to be present
    console.log("E2E: waiting for background video element");
    const videoSelector = "video.ep-bg-video-el, video[data-media-id]"; // background or gallery fallback
    await page.waitForSelector(videoSelector, { timeout: 30000 });
    const videoHandle = await page.$(videoSelector);
    if (!videoHandle) throw new Error("Video element not found");

    // Attach page-side listeners to detect playing/waiting events
    await page.exposeFunction("__e2e_log", (msg) => console.log("[PAGE-E2E]", msg));
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      try {
        el.addEventListener("playing", () => { if (window.__e2e_log) window.__e2e_log("video playing"); });
        el.addEventListener("waiting", () => { if (window.__e2e_log) window.__e2e_log("video waiting"); });
        el.addEventListener("canplay", () => { if (window.__e2e_log) window.__e2e_log("video canplay"); });
      } catch { /* no-op */ }
    }, videoSelector);

    // Wait up to WAIT_PLAYING_MS for the video to report 'playing' or for manifest+segment to be requested
    console.log("E2E: waiting for playback or network activity");
    const start = Date.now();
    let playing = false;
    // Poll for playing state and manifest/segment detection
    while (Date.now() - start < TIMEOUT_MS) {
      // Check if page video is playing
      const state = await page.evaluate((sel) => {
        const v = document.querySelector(sel);
        if (!v || !(v instanceof HTMLVideoElement)) return { exists: false };
        return { exists: true, paused: v.paused, currentSrc: v.currentSrc || v.src || "" , readyState: v.readyState };
      }, videoSelector);

      if (!state.exists) {
        console.log("E2E: video element disappeared");
        break;
      }

      // If video is not paused and readyState indicates playback, consider success
      if (!state.paused && state.readyState >= 3) {
        playing = true;
        console.log("E2E: video appears playing. currentSrc:", state.currentSrc);
        break;
      }

      // If network-level evidence of HLS is present (manifest + segments), we can still wait for playing but note progress
      if (seen.manifest && seen.segment) {
        console.log("E2E: detected manifest and segments network activity");
      }

      // short sleep
      await new Promise((r) => setTimeout(r, 1000));
    }

    // Capture screenshot for debugging
    const shotPath = "e2e-screenshot.png";
    try {
      await page.screenshot({ path: shotPath, fullPage: false });
      console.log("E2E: screenshot saved to", shotPath);
    } catch (e) {
      console.warn("E2E: screenshot failed", e);
    }

    // Additional check: inspect the video's currentSrc to confirm HLS manifest usage
    const finalSrc = await page.evaluate((sel) => {
      const v = document.querySelector(sel);
      if (!v) return "";
      // prefer currentSrc (set by player/hls.js) then src
      return v.currentSrc || v.src || "";
    }, videoSelector);
    console.log("E2E: video currentSrc ->", finalSrc);

    const usingHlsStream = typeof finalSrc === "string" && (finalSrc.includes("/videos/hls/") || finalSrc.includes(".m3u8"));
    if (usingHlsStream) {
      console.log("E2E: Detected HLS stream in video.currentSrc");
    } else {
      console.log("E2E: No HLS stream in video.currentSrc; falling back to network evidence");
    }

    // Evaluate final success: prefer explicit HLS src, otherwise manifest+segment observed
    if (usingHlsStream || playing || (seen.manifest && seen.segment)) {
      console.log("E2E: SUCCESS — HLS player initialized and streaming (or playback started).", { playing, seen, finalSrc, usingHlsStream });
      await browser.close();
      process.exit(0);
    } else {
      console.error("E2E: FAILURE — did not detect playback or HLS requests within timeout", { playing, seen, finalSrc, usingHlsStream });
      await browser.close();
      process.exit(2);
    }
  } catch (err) {
    console.error("E2E: unexpected error:", err);
    try { await browser.close(); } catch { /* no-op */ }
    process.exit(3);
  }
}

run();
