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

/**
 * Sanitizes a filename by removing forbidden characters
 * Forbidden characters: < > : " / \ | ? *
 * Also handles control characters and other invalid characters
 * @param {string} filename - The original filename
 * @returns {string} - Sanitized filename
 */
function sanitizeFilename(filename) {
  // Remove forbidden characters: < > : " / \ | ? * and control characters
  let sanitized = filename.replace(/[<>:"/\\|?*\x00-\x1f]/g, '');
  
  // Remove leading/trailing dots and spaces (Windows compatibility)
  sanitized = sanitized.replace(/^\.+|\.+$/g, '').trim();
  
  // Replace multiple consecutive spaces with a single space
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // If filename is empty after sanitization, use a default name
  if (sanitized.length === 0) {
    sanitized = 'video';
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
 * @returns {Promise<string>} - The filename of the downloaded video
 */
async function downloadVideo(url) {
  try {
    // Validate URL
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
      throw new Error('Invalid YouTube URL');
    }

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
    console.log(`Saving to: ${outputPath}`);

    // Download video with progress
    const downloadProcess = ytDlp.exec(url, {
      format: 'best[ext=mp4]/best',
      output: outputPath,
      noWarnings: true,
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

module.exports = {
  downloadVideo,
  sanitizeFilename,
};
