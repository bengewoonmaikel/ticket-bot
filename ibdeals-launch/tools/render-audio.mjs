// Renders audio/synth.html with an OfflineAudioContext in headless Chromium
// and writes audio/soundtrack.wav (48 kHz, 24-bit, stereo).
import puppeteer from "puppeteer-core";
import { writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const types = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  try {
    const file = join(root, decodeURIComponent(req.url.split("?")[0]));
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: process.env.HYPERFRAMES_BROWSER_PATH || "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  args: ["--no-sandbox"],
  protocolTimeout: 600000,
});
const page = await browser.newPage();
page.on("console", (m) => console.log("page:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.evaluateOnNewDocument(
  (g, mute) => {
    window.__PREGAIN = g;
    window.__MUTE = mute;
  },
  Number(process.env.PREGAIN || 1),
  (process.env.MUTE || "").split(",").filter(Boolean),
);
await page.goto(`http://127.0.0.1:${port}/audio/synth.html`);
const t0 = Date.now();
const res = await page.evaluate(() => window.renderSoundtrack());
const out = process.env.OUT || join(root, "audio", "soundtrack.wav");
writeFileSync(out, Buffer.from(res.b64, "base64"));
console.log(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(1)}s  raw peak ${res.gain.toFixed(3)}  out peak ${res.peak.toFixed(3)}  rms ${res.rms.toFixed(4)}  limited ${(100 * res.reducedFrac).toFixed(1)}% of samples`);
if (process.env.GR) {
  console.log("max gain reduction (dB) per 0.25 s:");
  console.log(res.grMax.map((d, i) => `${(i * 0.25).toFixed(2)}:${d.toFixed(1)}`).join(" "));
}
await browser.close();
server.close();
