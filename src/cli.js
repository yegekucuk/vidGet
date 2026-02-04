#!/usr/bin/env node

const downloader = require('./downloader');
const path = require('path');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: vidget <YouTube URL>');
  console.error('Example: vidget https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  process.exit(1);
}

const url = args[0];

downloader.downloadVideo(url)
  .then(filename => {
    console.log(`✓ Successfully downloaded: ${filename}`);
    process.exit(0);
  })
  .catch(error => {
    console.error(`✗ Error: ${error.message}`);
    process.exit(1);
  });
