#!/usr/bin/env node

const downloader = require('./downloader');

const args = process.argv.slice(2);
const MODE_FLAGS = new Set(['--auto', '--video', '--playlist']);

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
  console.error('Usage: vidget [--auto|--video|--playlist] <YouTube video or playlist URL>');
  console.error('Example (auto): vidget https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  console.error('Example (playlist): vidget --playlist https://www.youtube.com/playlist?list=PL1234567890');
  console.error('Example (video): vidget --video "https://www.youtube.com/watch?v=ID&list=LIST"');
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
let url = null;

for (const arg of args) {
  if (arg === '--help' || arg === '-h') {
    printUsage();
    process.exit(0);
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

downloadFn(url)
  .then(result => {
    console.log(successMessage(result));
    process.exit(0);
  })
  .catch(error => {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  });
