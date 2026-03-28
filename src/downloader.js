const ytDlp = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');

function toMiB(value, unit) {
  const num = Number(value);
  if (Number.isNaN(num)) return null;
  switch (unit) {
    case 'KiB':
      return num / 1024;
    case 'MiB':
      return num;
    case 'GiB':
      return num * 1024;
    default:
      return null;
  }
}

function formatMiB(value) {
  return `${value.toFixed(2)} MB`;
}

function validateYouTubeUrl(url) {
  if (typeof url !== 'string' || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
    throw new Error('Invalid YouTube URL');
  }
}

function createProgressHandler() {
  let lastLine = '';
  let buffer = '';
  const barWidth = 30;

  const renderBar = percent => {
    const filled = Math.round((percent / 100) * barWidth);
    const empty = barWidth - filled;
    return `[${'='.repeat(filled)}${'.'.repeat(empty)}]`;
  };

  return chunk => {
    buffer += chunk.toString();
    const parts = buffer.split(/\r|\n/);
    buffer = parts.pop() || '';

    for (const rawLine of parts) {
      const line = rawLine.trim();
      if (!line || !line.includes('[download]')) continue;
      if (line === lastLine) continue;
      lastLine = line;

      const matchWithTotal = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s+of\s+([0-9.]+)\s*(KiB|MiB|GiB)/i);
      const matchPercentOnly = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%/i);

      if (matchWithTotal) {
        const percent = Number(matchWithTotal[1]);
        const totalMiB = toMiB(matchWithTotal[2], matchWithTotal[3]);
        if (totalMiB !== null) {
          const downloadedMiB = (percent / 100) * totalMiB;
          process.stdout.write(`\r${renderBar(percent)} ${percent.toFixed(1)}%  ${formatMiB(downloadedMiB)} / ${formatMiB(totalMiB)}`);
          continue;
        }
      }

      if (matchPercentOnly) {
        const percent = Number(matchPercentOnly[1]);
        process.stdout.write(`\r${renderBar(percent)} ${percent.toFixed(1)}%`);
      }
    }
  };
}

function buildFormatSelector(quality) {
  return `bestvideo[height<=${quality}][ext=mp4][vcodec^=avc1]+bestaudio[ext=m4a][acodec^=mp4a]/bestvideo[height<=${quality}][vcodec^=avc1]+bestaudio[acodec^=mp4a]/bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}][ext=mp4][vcodec^=avc1][acodec^=mp4a]/best[height<=${quality}][vcodec^=avc1][acodec^=mp4a]/best[height<=${quality}][ext=mp4][vcodec!=none][acodec!=none]/best[height<=${quality}][vcodec!=none][acodec!=none]/best[ext=mp4][vcodec!=none][acodec!=none]/best[vcodec!=none][acodec!=none]`;
}

/**
 * Sanitizes a filename by removing forbidden characters
 * Forbidden characters: < > : " / \ | ? *
 * Also handles control characters and other invalid characters
 * @param {string} filename - The original filename
 * @param {string} fallbackName - Fallback name when sanitization results in empty string
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename, fallbackName = 'video') {
  if (typeof filename !== 'string') {
    filename = String(filename || fallbackName);
  }

  // Remove forbidden characters: < > : " / \ | ? * and control characters
  let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  
  // Remove leading/trailing dots and spaces (Windows compatibility)
  sanitized = sanitized.replace(/^\.+|\.+$/g, '').trim();
  
  // Replace multiple consecutive spaces with a single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // If filename is empty after sanitization, use a default name
  if (sanitized.length === 0) {
    sanitized = fallbackName;
  }
  
  // Limit filename length (most filesystems support 255 bytes)
  // Reserve 4 bytes for .mp4 extension
  const maxLength = 251;
  if (Buffer.byteLength(sanitized, 'utf8') > maxLength) {
    while (Buffer.byteLength(sanitized, 'utf8') > maxLength && sanitized.length > 0) {
      sanitized = sanitized.slice(0, -1);
    }
  }
  
  return sanitized;
}

/**
 * Downloads a YouTube video and saves it as MP4
 * @param {string} url - The YouTube video URL
 * @param {number} quality - Maximum video height in p
 * @returns {Promise<string>} - The filename of the downloaded video
 */
async function downloadVideo(url, quality = 360) {
  try {
    validateYouTubeUrl(url);

    console.log('Fetching video information...');

    // Get video info
    const info = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
    });
    
    if (!info) {
      throw new Error('Could not fetch video information');
    }

    const videoTitle = info.title || 'video';
    const sanitizedTitle = sanitizeFilename(videoTitle);
    const filename = `${sanitizedTitle}.mp4`;
    const outputPath = path.join(process.cwd(), filename);

    console.log(`Downloading: ${videoTitle}`);
    console.log(`Requested max quality: ${quality}p`);
    console.log(`Saving to: ${outputPath}`);

    // Download video with progress
    const downloadProcess = ytDlp.exec(url, {
      format: buildFormatSelector(quality),
      mergeOutputFormat: 'mp4',
      output: outputPath,
      forceOverwrites: true,
      noWarnings: true,
      windowsFilenames: true,
      preferFreeFormats: false,
      progress: true,
      newline: true,
    }, {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const handleProgress = createProgressHandler();
    if (downloadProcess.stderr) {
      downloadProcess.stderr.on('data', handleProgress);
    }
    if (downloadProcess.stdout) {
      downloadProcess.stdout.on('data', handleProgress);
    }

    await downloadProcess;
    process.stdout.write('\n');

    // Verify the file was created
    if (!fs.existsSync(outputPath)) {
      throw new Error('Download completed but file not found');
    }

    const stats = fs.statSync(outputPath);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`File size: ${sizeInMB} MB`);

    return filename;
  } catch (error) {
    throw new Error(`Failed to download video: ${error.message}`);
  }
}

/**
 * Downloads a YouTube playlist into a folder named after the playlist
 * @param {string} url - The YouTube playlist URL
 * @param {number} quality - Maximum video height in p
 * @returns {Promise<{folderName: string, videoCount: number}>} - Download details
 */
async function downloadPlaylist(url, quality = 360) {
  try {
    validateYouTubeUrl(url);

    console.log('Fetching playlist information...');

    const info = await ytDlp(url, {
      dumpSingleJson: true,
      noWarnings: true,
      yesPlaylist: true,
      flatPlaylist: true,
    });

    if (!info) {
      throw new Error('Could not fetch playlist information');
    }

    const isPlaylist = info._type === 'playlist' || Array.isArray(info.entries);
    if (!isPlaylist) {
      throw new Error('URL does not point to a playlist');
    }

    const playlistTitle = info.title || 'playlist';
    const folderName = sanitizeFilename(playlistTitle, 'playlist');
    const outputDir = path.join(process.cwd(), folderName);

    if (fs.existsSync(outputDir) && !fs.statSync(outputDir).isDirectory()) {
      throw new Error(`Cannot create playlist folder because a file already exists at ${outputDir}`);
    }

    fs.mkdirSync(outputDir, { recursive: true });

    const expectedCount = Array.isArray(info.entries) ? info.entries.length : 0;
    console.log(`Downloading playlist: ${playlistTitle}`);
    console.log(`Requested max quality: ${quality}p`);
    if (expectedCount > 0) {
      console.log(`Videos found: ${expectedCount}`);
    }
    console.log(`Saving to folder: ${outputDir}`);

    const outputTemplate = path.join(outputDir, '%(playlist_index)03d - %(title)s.%(ext)s');

    const downloadProcess = ytDlp.exec(url, {
      yesPlaylist: true,
      format: buildFormatSelector(quality),
      mergeOutputFormat: 'mp4',
      output: outputTemplate,
      forceOverwrites: true,
      noWarnings: true,
      windowsFilenames: true,
      preferFreeFormats: false,
      progress: true,
      newline: true,
    }, {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const handleProgress = createProgressHandler();
    if (downloadProcess.stderr) {
      downloadProcess.stderr.on('data', handleProgress);
    }
    if (downloadProcess.stdout) {
      downloadProcess.stdout.on('data', handleProgress);
    }

    await downloadProcess;
    process.stdout.write('\n');

    const downloadedFiles = fs.readdirSync(outputDir).filter(entry => {
      const fullPath = path.join(outputDir, entry);
      return fs.statSync(fullPath).isFile();
    });

    if (downloadedFiles.length === 0) {
      throw new Error('Playlist download completed but no files were found in the output folder');
    }

    console.log(`Downloaded ${downloadedFiles.length} video(s)`);

    return {
      folderName,
      videoCount: downloadedFiles.length,
    };
  } catch (error) {
    throw new Error(`Failed to download playlist: ${error.message}`);
  }
}

module.exports = {
  downloadVideo,
  downloadPlaylist,
  sanitizeFilename,
};
