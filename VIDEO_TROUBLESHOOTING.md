# Video Player Troubleshooting Guide

## Recent Fixes Applied

### 1. Enhanced Codec Detection & Fallback
- **Issue**: Videos only playing for a few seconds due to H.264 High Profile codec incompatibility
- **Solution**: Added comprehensive codec detection including VP8/VP9, HEVC, and AAC/Opus support
- **Impact**: Better browser compatibility and automatic fallback to MP4 when HLS fails

### 2. Improved Error Handling
- **Issue**: Generic error messages and poor recovery from failures
- **Solution**: Categorized errors (network, codec, buffer) with specific recovery strategies
- **Impact**: More informative error messages and smarter retry logic

### 3. Server Connectivity Checks
- **Issue**: ERR_CONNECTION_REFUSED errors when dev server isn't running
- **Solution**: Added pre-flight server connectivity checks before video loading
- **Impact**: Clear error messages when server is down and guidance for resolution

### 4. Browser-Specific Optimizations
- **Issue**: Same configuration for all browsers causing issues on Safari/mobile
- **Solution**: Browser-aware HLS configuration with optimized settings per platform
- **Impact**: Better performance on Safari and mobile devices

## Common Issues & Solutions

### ERR_CONNECTION_REFUSED
```
WebSocket connection to 'ws://localhost:5174/?token=...' failed
Failed to load resource: net::ERR_CONNECTION_REFUSED
```

**Solutions:**
1. Start the dev server: `npm run dev`
2. Check if port 5174 is available: `lsof -i :5174`
3. Kill any process using the port: `lsof -ti:5174 | xargs kill -9`
4. Clear Vite cache: `rm -rf node_modules/.vite`

### Codec Compatibility Issues
```
Video format not supported - H.264 High Profile codec issue detected
MEDIA_ELEMENT_ERROR: Empty src attribute
```

**Solutions:**
1. Try a different browser (Chrome, Firefox, Safari have different codec support)
2. Clear browser cache and cookies
3. Check browser console for detailed codec information
4. The app now automatically falls back to MP4 when HLS fails

### Buffer/Stalled Playback
```
Video stalled - buffering stopped unexpectedly
Buffer gap detected
```

**Solutions:**
1. Check your internet connection
2. Wait for automatic recovery (up to 8 seconds)
3. The app will automatically advance to the next video if issues persist
4. Try refreshing the page

## Diagnostic Tools

### Server Check Script
Run the diagnostic script to check server and video file accessibility:

```bash
node check-server.js
```

This will:
- Verify server connectivity
- Check if video files are accessible
- Provide specific troubleshooting recommendations

### Browser Console Debugging
Open browser dev tools and look for these log messages:

- `[VideoPlayer] Server connectivity confirmed` - Server is accessible
- `[VideoPlayer] Video file accessibility confirmed` - Video files found
- `[VideoPlayer] H.264 High Profile not supported` - Codec compatibility issue
- `[VideoPlayer] Attempting codec fallback strategies` - Recovery in progress

## Video Configuration

### Supported Formats
- **HLS (.m3u8)**: Primary format with adaptive bitrate
- **MP4 (.mp4)**: Fallback format for codec incompatibility
- **Codecs**: H.264 (all profiles), VP8, VP9, HEVC, AAC, Opus

### Browser Support
- **Safari**: Native HLS support, optimized settings
- **Chrome/Firefox**: Software decoding for H.264 High Profile
- **Mobile**: Conservative buffer settings for unstable networks

## Performance Optimizations

### Buffer Management
- Browser-aware buffer sizes (smaller on mobile)
- Automatic gap detection and filling
- Conservative retry logic for mobile networks

### Network Handling
- Connection timeouts based on browser/platform
- Retry delays optimized for different error types
- Server connectivity pre-checks

## Development Notes

### Video File Structure
```
public/videos/
├── hls/                    # HLS streaming files
│   └── [Video Name]/
│       ├── index.m3u8     # HLS manifest
│       └── *.ts          # Video segments
└── [Video Name].mp4       # MP4 fallback files
```

### Configuration Files
- `vite.config.ts`: Dev server configuration
- `check-server.js`: Diagnostic script
- `src/components/VideoPlayer.tsx`: Main video player logic
- `src/components/ModernBackgroundVideo.tsx`: Background video wrapper

## Still Having Issues?

1. Run the diagnostic script: `node check-server.js`
2. Check browser console for detailed error messages
3. Try a different browser
4. Clear browser cache and restart the dev server
5. Ensure video files exist in the correct locations

If problems persist, the enhanced error logging will provide specific information about what's failing and why.
