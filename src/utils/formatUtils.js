function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "unknown";
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

function isMasterUrl(url) {
  // Matches "master.m3u8", "master_1080.m3u8", ".../master?..."
  return /(^|\/)master([_-][^\/?]+)?\.m3u8(\?|$)/i.test(url);
}

module.exports = {
  formatDuration,
  isMasterUrl,
};
