import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixManifest(dirPath) {
  const manifestPath = path.join(dirPath, 'index.m3u8');
  if (!fs.existsSync(manifestPath)) return;

  const dirName = path.basename(dirPath);
  const encodedDir = dirName
    .replace(/ /g, '%20')
    .replace(/&/g, '%26')
    .replace(/\+/g, '%2B')
    .replace(/ñ/g, '%C3%B1'); // Handle special chars like ñ

  let content = fs.readFileSync(manifestPath, 'utf8');
  content = content.replace(/seg(\d+)\.ts/g, `/videos/hls/${encodedDir}/seg$1.ts`);
  fs.writeFileSync(manifestPath, content);
  console.log(`Fixed ${manifestPath}`);
}

const hlsDir = path.join(__dirname, 'public/videos/hls');
const dirs = fs.readdirSync(hlsDir, { withFileTypes: true })
  .filter(dirent => dirent.isDirectory())
  .map(dirent => path.join(hlsDir, dirent.name));

dirs.forEach(fixManifest);
console.log('All manifests fixed!');
