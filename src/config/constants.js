const YTDLP_OUTPUT_TEMPLATE = "%(title).250s.%(ext)s"; // filename truncated at save-time

const DEFAULT_CONFIG = {
  outDir: process.cwd(),
  browserExe: null,
  discoverTimeout: 15000,
  noBrowser: false,
};

const BROWSER_LAUNCH_OPTIONS = {
  headless: "new",
  defaultViewport: { width: 1366, height: 768 },
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--mute-audio",
  ],
};

const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

module.exports = {
  YTDLP_OUTPUT_TEMPLATE,
  DEFAULT_CONFIG,
  BROWSER_LAUNCH_OPTIONS,
  USER_AGENT,
};
