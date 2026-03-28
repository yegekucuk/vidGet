#!/usr/bin/env node

const downloader = require('./downloader');

const args = process.argv.slice(2);
const MODE_FLAGS = new Set(['--auto', '--video', '--playlist']);
const DEFAULT_QUALITY = 360;

function isPlaylistUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const hasListParam = parsedUrl.searchParams.has('list');
    const hasVideoParam = parsedUrl.searchParams.has('v');

    return parsedUrl.pathname === '/playlist' || (hasListParam && !hasVideoParam);
  } catch {
    return false;
  }
}

function printUsage() {
  console.error('Usage: vidget [--auto|--video|--playlist] [--quality <p>] <YouTube video or playlist URL>');
  console.error('Example (auto): vidget https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  console.error('Example (playlist): vidget --playlist https://www.youtube.com/playlist?list=PL1234567890');
  console.error('Example (video): vidget --video "https://www.youtube.com/watch?v=ID&list=LIST"');
  console.error('Example (quality): vidget --quality 720 https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  console.error(`Default quality: ${DEFAULT_QUALITY}p`);
}

function exitWithUsage(message) {
  if (message) {
    console.error(`✗ ${message}`);
  }
  printUsage();
  process.exit(1);
}

let selectedMode = 'auto';
const modeFlags = new Set();
let quality = DEFAULT_QUALITY;
let qualityFlagProvided = false;
let url = null;

function parseQuality(rawValue) {
  if (!/^\d+$/.test(rawValue)) {
    exitWithUsage('Quality must be a positive integer (for example: 360, 720, 1080).');
  }

  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    exitWithUsage('Quality must be a positive integer.');
  }

  return parsedValue;
}

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];

  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
  }

  if (arg === '--quality') {
    if (qualityFlagProvided) {
      exitWithUsage('Use --quality only once.');
    }

    const rawValue = args[i + 1];
    if (rawValue === undefined || rawValue.startsWith('--')) {
      exitWithUsage('Missing value for --quality.');
    }

    quality = parseQuality(rawValue);
    qualityFlagProvided = true;
    i += 1;
    continue;
  }

  if (arg.startsWith('--quality=')) {
    if (qualityFlagProvided) {
      exitWithUsage('Use --quality only once.');
    }

    const rawValue = arg.slice('--quality='.length);
    if (!rawValue) {
      exitWithUsage('Missing value for --quality.');
    }

    quality = parseQuality(rawValue);
    qualityFlagProvided = true;
    continue;
  }

  if (arg.startsWith('--')) {
    if (!MODE_FLAGS.has(arg)) {
      exitWithUsage(`Unknown flag: ${arg}`);
    }

    modeFlags.add(arg);
    continue;
  }

  if (url !== null) {
    exitWithUsage('Please provide exactly one URL.');
  }

  url = arg;
}

if (modeFlags.size > 1) {
  exitWithUsage('Use only one mode flag at a time.');
}

if (modeFlags.size === 1) {
  selectedMode = [...modeFlags][0].slice(2);
}

if (!url) {
  exitWithUsage('Missing YouTube URL.');
}

const playlistMode = selectedMode === 'playlist'
  || (selectedMode === 'auto' && isPlaylistUrl(url));

const downloadFn = playlistMode
  ? downloader.downloadPlaylist
  : downloader.downloadVideo;

const successMessage = playlistMode
  ? result => `✓ Successfully downloaded playlist to folder: ${result.folderName} (${result.videoCount} videos)`
  : filename => `✓ Successfully downloaded: ${filename}`;

downloadFn(url, quality)
  .then(result => {
    console.log(successMessage(result));
    process.exit(0);
  })
  .catch(error => {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  });
