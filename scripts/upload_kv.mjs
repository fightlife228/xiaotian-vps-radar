#!/usr/bin/env node
/**
 * Upload all static web assets into Cloudflare KV namespace `SITE_KV`
 * using `wrangler kv bulk put`.
 *
 * Usage:
 *   npx wrangler login
 *   node scripts/upload_kv.mjs --namespace-id <YOUR_KV_NAMESPACE_ID>
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const INCLUDE_FILES = [
  "index.html",
  "table.html",
  "about.html",
  "404.html",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "llms.txt",
  "assets/site.css",
  "assets/theme.js",
  "assets/app.js",
  "data/offers.json",
  "data/leads.json"
];
const INCLUDE_DIRS = ["guides", "assets/blog"];
const BINARY_EXTS = new Set([".png", ".webp", ".ico", ".jpg", ".jpeg"]);

const idx = process.argv.indexOf("--namespace-id");
const namespaceId = idx >= 0 ? process.argv[idx + 1] : process.env.KV_NAMESPACE_ID;
if (!namespaceId) {
  console.error("Missing --namespace-id <KV_NAMESPACE_ID> (or KV_NAMESPACE_ID env var).");
  process.exit(1);
}

const files = [];
for (const rel of INCLUDE_FILES) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) files.push(rel);
}
for (const dir of INCLUDE_DIRS) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;
  for (const name of fs.readdirSync(fullDir)) {
    const full = path.join(fullDir, name);
    if (fs.statSync(full).isFile()) files.push(path.posix.join(dir, name));
  }
}

const bulk = files.map((rel) => {
  const full = path.join(ROOT, rel);
  const ext = path.extname(rel).toLowerCase();
  const key = `static:/${rel.replace(/\\/g, "/")}`;
  if (BINARY_EXTS.has(ext)) {
    return { key, value: fs.readFileSync(full).toString("base64"), base64: true };
  }
  return { key, value: fs.readFileSync(full, "utf8") };
});

const tmp = path.join(os.tmpdir(), `vps-radar-kv-${Date.now()}.json`);
fs.writeFileSync(tmp, JSON.stringify(bulk), "utf8");
try {
  console.log(`Uploading ${bulk.length} static assets to KV namespace ${namespaceId}...`);
  execFileSync("npx", ["wrangler", "kv", "bulk", "put", tmp, "--namespace-id", namespaceId, "--remote"], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  console.log("Done!");
} finally {
  fs.rmSync(tmp, { force: true });
}
