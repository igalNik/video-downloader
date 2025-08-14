# Video Downloader

A modular video downloader application with progressive fallback strategies for downloading videos from various sources.

## Architecture

The application has been refactored into a clean, modular architecture:

```
src/
├── config/
│   └── constants.js          # Configuration constants and defaults
├── services/
│   ├── argumentParser.js     # Command line argument parsing
│   ├── browserService.js     # Browser-based m3u8 discovery
│   ├── downloadService.js    # Main download orchestration
│   ├── infoService.js        # Info.json processing and summaries
│   └── ytDlpService.js       # yt-dlp execution wrapper
├── utils/
│   ├── fileUtils.js          # File system operations
│   └── formatUtils.js        # Formatting utilities
└── index.js                  # Main application entry point
```

## Features

- **Progressive Fallback Strategy:**
  1. Try original URL with yt-dlp
  2. Retry with `--use-extractors generic`
  3. Browser-based network discovery for .m3u8 files

- **Smart File Organization:**
  - Per-URL subdirectories with sanitized names
  - Automatic truncation to 250 characters at save-time
  - Comprehensive download summaries

- **Browser Integration:**
  - Headless Puppeteer for network monitoring
  - Master m3u8 detection and prioritization
  - Configurable browser executable path

## Usage

### Basic Usage
```bash
# Download single URL
npm start <url>

# Download from file
npm run dl

# Custom output directory
npm start -- --out downloads <url>
```

### Advanced Options
```bash
# Use specific browser executable
npm start -- --browser-exe "C:\Program Files\Google\Chrome\Application\chrome.exe" <url>

# Custom discovery timeout
npm start -- --discover-timeout 20000 <url>

# Skip browser discovery
npm start -- --no-browser <url>
```

## Dependencies

- **Node.js** >= 18
- **Python** with yt-dlp installed
- **Puppeteer** (optional, for browser-based discovery)

## Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install yt-dlp:
   ```bash
   pip install yt-dlp
   ```

3. Create a `urls.txt` file with your URLs (one per line, # for comments)

## Output Structure

```
output_directory/
├── url_sanitized_folder_1/
│   ├── video_file.mp4
│   └── video_file.info.json
├── url_sanitized_folder_2/
│   ├── video_file.mp4
│   └── video_file.info.json
└── download_summary.json
```

The `download_summary.json` contains metadata for all downloaded videos including titles, durations, extractors, and source URLs.
