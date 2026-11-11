// Seeds (or with --reset, re-seeds) the synthetic Tessera traveler through the running API.
// Usage: npm run db:seed [-- --reset] [-- --url http://127.0.0.1:8787]
const args = process.argv.slice(2);
const urlArg = args.includes("--url") ? args[args.indexOf("--url") + 1] : undefined;
const url = (urlArg || process.env.TESSERA_API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");

async function call(path, init = {}) {
  const res = await fetch(url + path, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${body.error ?? ""}`);
  return body;
}

try {
  const { token } = await call("/api/v1/auth/demo-login", { method: "POST", body: JSON.stringify({ code: "jordan-rivera" }) });
  const auth = { Authorization: `Bearer ${token}` };
  if (args.includes("--reset")) await call("/api/v1/presenter/reset", { method: "POST", headers: auth, body: "{}" });
  const me = await call("/api/v1/me", { headers: auth });
  const card = await call("/api/v1/card", { headers: auth });
  await call("/api/v1/auth/logout", { method: "POST", headers: auth, body: "{}" });
  console.log(`Seeded ${me.traveler.name} on ${url}\nCard URL: ${card.cardUrl} (${card.status})`);
} catch (e) {
  console.error(`Seeding failed against ${url}: ${e.message}\nIs the server running? Try: npm run build && npm start`);
  process.exit(1);
}
