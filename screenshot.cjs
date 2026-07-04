// Single-shot: start Next.js, screenshot the site, kill server
const { spawn } = require("child_process");
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const ROOT = __dirname;
const log = (m) => console.log(`[screenshot] ${m}`);

(async () => {
  log("starting next server...");
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", PORT: "3000" };
  const server = spawn("node", ["node_modules/next/dist/bin/next", "start", "-p", "3000"], {
    cwd: ROOT,
    env,
    stdio: "pipe",
  });
  let serverOut = "";
  server.stdout.on("data", (d) => { serverOut += d.toString(); });
  server.stderr.on("data", (d) => { serverOut += d.toString(); });

  // Wait for "Ready" or "started server"
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("timeout")), 30000);
    const check = () => {
      if (/Ready in|started server/i.test(serverOut)) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
  log("server is up");

  const browser = await chromium.launch();
  try {
    // Desktop screenshot — full page
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    log("navigating...");
    await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1500);
    log("desktop: capturing full page...");
    await page.screenshot({ path: path.join(ROOT, "preview-desktop.png"), fullPage: true });
    log("desktop: capturing above-the-fold (hero)...");
    await page.screenshot({ path: path.join(ROOT, "preview-hero.png"), fullPage: false });
    await ctx.close();

    // Mobile screenshot (iPhone-ish)
    log("mobile viewport...");
    const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const mpage = await mctx.newPage();
    await mpage.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
    await mpage.waitForTimeout(1500);
    log("mobile: capturing above-the-fold...");
    await mpage.screenshot({ path: path.join(ROOT, "preview-mobile-hero.png"), fullPage: false });
    log("mobile: capturing full page...");
    await mpage.screenshot({ path: path.join(ROOT, "preview-mobile.png"), fullPage: true });
    await mctx.close();
  } finally {
    await browser.close();
    server.kill("SIGTERM");
    log("done");
  }
})().catch(async (e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
