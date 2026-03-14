# vidGet - YouTube Video Downloader CLI
vidGet is a Node.js CLI tool to download YouTube videos as MP4 files.

vidGet;
- Downloads YouTube videos to MP4 format ✅
- Downloads YouTube playlists into a folder named after the playlist ✅
- Saves videos to the current working directory ✅
- Names files after the video title ✅
- Removes all forbidden filename characters (Windows + Unix) ✅
- Handles long filenames safely ✅
- Shows live progress with a loading bar and MB transferred ✅

## Installation
```bash
git clone https://github.com/yegekucuk/vidGet
cd vidGet
npm install && sudo npm link
```

## Prerequisites
This tool uses `yt-dlp` on your system. Install it first:
```bash
brew install yt-dlp         # macOS
sudo apt-get install yt-dlp # ubuntu/debian
sudo dnf install yt-dlp     # fedora/rhel
choco install yt-dlp        # windows
```
## Usage
```bash
vidget <YouTube video or playlist URL>
```

### Playlist download
Paste a playlist URL and vidGet will create a folder with the playlist name, then download all videos into it:

```bash
vidget "https://www.youtube.com/playlist?list=PL1234567890"
```

### URLs with "&"
If your URL contains `&`, wrap it in quotes or so the shell doesn't split it:
```bash
vidget "https://www.youtube.com/watch?v=ID&list=LIST&start_radio=1"
```

## License
MIT
