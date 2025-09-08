#!/usr/bin/env node

/**
 * Server and Video Troubleshooting Script
 * Run this to diagnose common issues with video playback
 */

import https from 'https';
import http from 'http';

const SERVER_URL = 'http://localhost:5174';
const VIDEOS_TO_CHECK = [
  '/videos/hls/CNCO%20-%20Reggaeto%CC%81n%20Lento%20(Bailemos)/index.m3u8',
  '/videos/hls/Julian%20Casablancas%2BThe%20Voidz%20-%20Human%20Sadness/index.m3u8',
  '/videos/Fleetwood%20Mac%20-%20Landslide%20(Live).mp4'
];

console.log('🔍 Video Server Troubleshooting Tool');
console.log('=====================================\n');

async function checkServerConnection() {
  console.log('1. Checking server connectivity...');

  return new Promise((resolve) => {
    const url = new URL(SERVER_URL);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: url.hostname,
      port: url.port,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Server is running and responding');
        resolve(true);
      } else {
        console.log(`❌ Server responded with status: ${res.statusCode}`);
        resolve(false);
      }
    });

    req.on('error', (err) => {
      console.log(`❌ Cannot connect to server: ${err.message}`);
      console.log('\n💡 Suggestions:');
      console.log('   - Make sure the dev server is running: npm run dev');
      console.log('   - Check if port 5174 is available');
      console.log('   - Try restarting the dev server');
      resolve(false);
    });

    req.on('timeout', () => {
      console.log('❌ Server connection timed out');
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

async function checkVideoFiles() {
  console.log('\n2. Checking video file accessibility...');

  for (const videoPath of VIDEOS_TO_CHECK) {
    await new Promise((resolve) => {
      const url = new URL(SERVER_URL + videoPath);
      const client = url.protocol === 'https:' ? https : http;

      const req = client.request({
        hostname: url.hostname,
        port: url.port,
        path: videoPath,
        method: 'HEAD',
        timeout: 5000
      }, (res) => {
        if (res.statusCode === 200) {
          console.log(`✅ ${videoPath} - Available`);
        } else {
          console.log(`❌ ${videoPath} - Status: ${res.statusCode}`);
        }
        resolve();
      });

      req.on('error', () => {
        console.log(`❌ ${videoPath} - Not accessible`);
        resolve();
      });

      req.on('timeout', () => {
        console.log(`⏱️  ${videoPath} - Timeout`);
        req.destroy();
        resolve();
      });

      req.end();
    });
  }
}

async function provideRecommendations() {
  console.log('\n3. Troubleshooting Recommendations:');
  console.log('----------------------------------');

  console.log('\n📹 For Video Playback Issues:');
  console.log('   - Try a different browser (Chrome, Firefox, Safari)');
  console.log('   - Clear browser cache and cookies');
  console.log('   - Check browser console for codec-related errors');
  console.log('   - Ensure your browser supports H.264 video codec');

  console.log('\n🌐 For Server Connection Issues:');
  console.log('   - Run: npm run dev');
  console.log('   - Check if ports 5174 and 5173 are available');
  console.log('   - Try: lsof -i :5174 to see what\'s using the port');
  console.log('   - Restart your development server');

  console.log('\n🎥 For Codec Compatibility Issues:');
  console.log('   - Videos use H.264 High Profile Level 3.0');
  console.log('   - Safari has native HLS support');
  console.log('   - Chrome/Firefox may need software decoding');
  console.log('   - Mobile devices may have limited codec support');

  console.log('\n🔧 Quick Fix Commands:');
  console.log('   - Kill process on port 5174: lsof -ti:5174 | xargs kill -9');
  console.log('   - Start fresh dev server: npm run dev');
  console.log('   - Clear Vite cache: rm -rf node_modules/.vite');
}

async function main() {
  const serverOk = await checkServerConnection();
  await checkVideoFiles();
  await provideRecommendations();

  console.log('\n✨ Done! If issues persist, check the browser console for detailed error messages.');
}

main().catch(console.error);
