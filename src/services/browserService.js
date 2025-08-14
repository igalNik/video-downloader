const { BROWSER_LAUNCH_OPTIONS, USER_AGENT } = require("../config/constants");
const { isMasterUrl } = require("../utils/formatUtils");

async function findM3u8ViaBrowser(
  originalUrl,
  { browserExe, timeoutMs = 15000 } = {}
) {
  let puppeteer;
  try {
    puppeteer = require("puppeteer");
  } catch {
    console.warn("! Puppeteer is not installed. Run: npm install puppeteer");
    return [];
  }

  const launchOpts = { ...BROWSER_LAUNCH_OPTIONS };
  if (browserExe) launchOpts.executablePath = browserExe;

  const browser = await puppeteer.launch(launchOpts);
  const page = await browser.newPage();

  await page.setUserAgent(USER_AGENT);

  const masters = new Set();
  const others = new Set();

  const consider = (u) => {
    if (!/\.m3u8(\?|$)/i.test(u)) return;
    if (isMasterUrl(u)) masters.add(u);
    else others.add(u);
  };

  // Collect from both requests and responses
  page.on("request", (req) => {
    try {
      consider(req.url());
    } catch {}
  });
  page.on("response", (res) => {
    try {
      const u = res.url();
      const s = res.status();
      if (s >= 200 && s < 400) consider(u);
    } catch {}
  });

  try {
    const nav = page.goto(originalUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    const timer = new Promise((r) => setTimeout(r, timeoutMs));
    await Promise.race([nav.then(() => timer), timer]);
  } catch (e) {
    console.warn(`! Navigation error: ${e}`);
  } finally {
    await browser.close().catch(() => {});
  }

  // Build final list: masters first; then others
  const list = [...masters, ...others];

  if (list.length) {
    console.log("• Browser discovered .m3u8 candidates (masters first):");
    for (const c of list.slice(0, 8)) console.log("  -", c);
    if (list.length > 8) console.log(`  ...(+${list.length - 8} more)`);
  } else {
    console.log("• Browser discovered no .m3u8 candidates.");
  }

  return list;
}

module.exports = {
  findM3u8ViaBrowser,
};
