// Put Parity on your phone: builds the app, starts the server with an access code, opens a free HTTPS tunnel
// (Cloudflare quick tunnel: the mic only works over HTTPS) and prints the link and a QR code to scan.
//   npm run phone            # tunnel: works from any network, link changes each run
//   npm run phone -- --lan   # same Wi-Fi only, no tunnel: https://<laptop-ip>:5443 (accept the certificate warning)
// Needs OPENAI_API_KEY for live translation; the recorded demo (D) and private mode (P) work without it.
// The tunnel needs cloudflared: winget install Cloudflare.cloudflared (Windows) / brew install cloudflared (Mac).
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import net from "node:net";
import os from "node:os";
import qrcode from "qrcode-terminal";

const args = process.argv.slice(2);
const LAN = args.includes("--lan");
const PORT = Number(process.env.PORT || 5173);
const CODE = process.env.ACCESS_CODE || crypto.randomBytes(4).toString("hex");
const kids = [];
const stop = (code = 0) => {
  // On Windows a child started through the shell is cmd.exe; kill its whole tree so cloudflared goes too.
  for (const k of kids) {
    if (process.platform === "win32" && k.pid) spawnSync("taskkill", ["/pid", String(k.pid), "/T", "/F"], { stdio: "ignore" });
    else k.kill();
  }
  process.exit(typeof code === "number" ? code : 0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

function show(url) {
  const link = `${url}/?code=${CODE}`;
  console.log(`\n  Open this on your phone (or scan the code):\n\n  ${link}\n`);
  qrcode.generate(link, { small: true });
  console.log(`  The link unlocks the app on that phone once (access code ${CODE}). Ctrl+C stops everything.\n`);
}

// The dev server (npm run dev) uses the same port: say so instead of failing halfway.
const busy = await new Promise((resolve) => {
  const t = net.createServer().once("error", () => resolve(true)).once("listening", () => t.close(() => resolve(false)));
  t.listen(PORT);
});
if (busy) {
  console.error(`Port ${PORT} is in use (is npm run dev running?). Stop it first, or run with another port: PORT=5180 npm run phone`);
  process.exit(1);
}

if (!args.includes("--no-build")) {
  console.log("Building…");
  const b = spawnSync("npx", ["vite", "build", "--logLevel", "warn"], { stdio: "inherit", shell: true });
  if (b.status !== 0) process.exit(b.status || 1);
}

const server = spawn(process.execPath, ["server/index.mjs", "--prod"], { env: { ...process.env, PORT: String(PORT), ACCESS_CODE: CODE }, stdio: ["ignore", "pipe", "inherit"] });
kids.push(server);
server.on("exit", (c) => {
  console.error(`server stopped (${c})`);
  process.exit(c || 1);
});
await new Promise((resolve) => {
  server.stdout.on("data", (d) => {
    process.stdout.write(d);
    if (/this computer/.test(String(d))) resolve();
  });
});

if (LAN) {
  const ips = Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === "IPv4" && !n.internal).map((n) => n.address);
  if (!ips.length) {
    console.error("No Wi-Fi address found. Try the tunnel: npm run phone");
    stop(1);
  }
  show(`https://${ips[0]}:${process.env.HTTPS_PORT || 5443}`);
} else {
  // cloudflared on PATH if installed, else the npm wrapper (downloads the binary the first time).
  const onPath = spawnSync(process.platform === "win32" ? "where" : "which", ["cloudflared"], { stdio: "ignore", shell: true }).status === 0;
  const [cmd, ...rest] = onPath ? ["cloudflared"] : ["npx", "-y", "cloudflared"];
  const tunnel = spawn(cmd, [...rest, "tunnel", "--no-autoupdate", "--url", `http://localhost:${PORT}`], { stdio: ["ignore", "pipe", "pipe"], shell: process.platform === "win32" });
  kids.push(tunnel);
  let shown = false;
  const watch = (d) => {
    const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (m && !shown) {
      shown = true;
      show(m[0]);
    }
  };
  tunnel.stdout.on("data", watch);
  tunnel.stderr.on("data", watch);
  tunnel.on("exit", (c) => {
    if (!shown) console.error("\nThe tunnel didn't start. Install cloudflared (winget install Cloudflare.cloudflared), or use npm run phone -- --lan on the same Wi-Fi.");
    stop(c);
  });
}
