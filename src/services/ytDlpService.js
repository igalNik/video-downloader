const { spawn } = require("child_process");
const { YTDLP_OUTPUT_TEMPLATE } = require("../config/constants");

function runYtDlp(url, cwd, extra = []) {
  const cmd = "python";
  const base = [
    "-m",
    "yt_dlp",
    "--write-info-json",
    "-o",
    YTDLP_OUTPUT_TEMPLATE,
  ];
  const args = [...base, ...extra, url];

  console.log(`\n$ (cwd=${cwd}) ${cmd} ${args.join(" ")}`);

  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit", cwd });
    child.on("close", (code) => resolve(code));
  });
}

module.exports = {
  runYtDlp,
};
