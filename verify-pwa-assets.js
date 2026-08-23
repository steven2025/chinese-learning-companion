#!/usr/bin/env node
/**
 * PWA 发布自检脚本
 * 检查 GitHub Pages 发布内容：
 *  1) sw.js 的 APP_SHELL 每一项在磁盘上真实存在；
 *  2) 所有 HTML 引用的带 ?v= 版本资源都已被 APP_SHELL 预缓存；
 *  3) HTML 引用的本地资源在磁盘上都存在（防“上传了但没更新”）。
 * 用法：node tools/verify-pwa-assets.js
 */
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const swPath = path.join(root, "sw.js");

if (!fs.existsSync(swPath)) {
  console.error("ERROR: 找不到 " + swPath);
  process.exit(1);
}

const errors = [];

function err(msg) { errors.push(msg); console.error("ERROR: " + msg); }

// ---- 1. 解析 sw.js ----
const sw = fs.readFileSync(swPath, "utf8");
const versionMatch = sw.match(/CACHE_VERSION\s*=\s*"([^"]+)"/);
const shellMatch = sw.match(/const APP_SHELL = \[([\s\S]*?)\];/);
if (!versionMatch || !shellMatch) {
  err("sw.js 中未找到 CACHE_VERSION 或 APP_SHELL");
  process.exit(1);
}
const cacheVersion = versionMatch[1];
const appShell = [...shellMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
console.log("CACHE_VERSION:", cacheVersion);
console.log("APP_SHELL 条目数:", appShell.length);

const shellSet = new Set(appShell);
for (const entry of appShell) {
  const rel = entry.replace(/^\.\//, "").split("?")[0];
  if (!fs.existsSync(path.join(root, rel))) {
    err("APP_SHELL 条目不存在: " + entry);
  }
}

// ---- 2. 扫描 HTML ----
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".html")) out.push(full);
  }
}
const htmlFiles = [];
walk(root, htmlFiles);

const refRe = /(?:src|href)\s*=\s*"([^"]+)"/g;
for (const htmlFile of htmlFiles.sort()) {
  const html = fs.readFileSync(htmlFile, "utf8");
  const relHtml = path.relative(root, htmlFile).replace(/\\/g, "/");
  let m;
  while ((m = refRe.exec(html))) {
    const raw = m[1];
    if (/^(https?:|data:|#|mailto:|blob:)/i.test(raw)) continue;
    const pathOnly = raw.split(/[?#]/)[0];
    const query = (raw.split("?")[1] || "").split("#")[0];
    if (!pathOnly) continue;

    const resolved = path.resolve(path.dirname(htmlFile), pathOnly);
    const rel = "./" + path.relative(root, resolved).replace(/\\/g, "/");

    if (!fs.existsSync(resolved)) {
      err(`${relHtml} 引用了不存在的文件: ${raw} -> ${rel}`);
      continue;
    }
    if (query.startsWith("v=")) {
      const key = rel + "?" + query;
      if (!shellSet.has(key)) {
        err(`${relHtml} 的版本化资源未加入 APP_SHELL: ${raw} (期望 ${key})`);
      }
    }
  }
}

// ---- 3. 汇总 ----
const shellMissingOnDisk = errors.filter((e) => e.startsWith("APP_SHELL 条目不存在"));
const htmlMissingAssets = errors.filter((e) => e.includes("引用了不存在的文件"));
const notInShell = errors.filter((e) => e.includes("未加入 APP_SHELL"));
console.log("---");
console.log(`HTML 页面数: ${htmlFiles.length}`);
console.log(`磁盘缺失(APP_SHELL): ${shellMissingOnDisk.length}`);
console.log(`磁盘缺失(HTML 引用): ${htmlMissingAssets.length}`);
console.log(`未加入 APP_SHELL: ${notInShell.length}`);

if (errors.length) {
  console.error("自检未通过，请先修复再发布。");
  process.exit(1);
}
console.log("自检通过：APP_SHELL 与 HTML 版本资源完全一致。");
