#!/usr/bin/env node

const downloader = require('./downloader');

const args = process.argv.slice(2);

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

if (args.length === 0) {
  console.error('Usage: vidget <YouTube video or playlist URL>');
  console.error('Example: vidget https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  console.error('Playlist example: vidget https://www.youtube.com/playlist?list=PL1234567890');
  process.exit(1);
}

const url = args[0];
const playlistMode = isPlaylistUrl(url);

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
