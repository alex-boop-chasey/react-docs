/*
============================================================
🧭 UNIVERSAL DOCUMENTATION COMPILER — SETUP INSTRUCTIONS
============================================================

📁 1. SCRIPT LOCATION
------------------------------------------------------------
- Place this script inside the following folder structure:

  /your-repo/
  ├── scripts/
  │   └── sync-docs/
  │       └── sync-docs-universal.mjs
  ├── src/
  ├── docs/
  └── package.json

- The script automatically steps two levels up (to the repo
  root) and crawls all folders and subfolders from there.

- The compiled output files will be written into:
      /scripts/sync-docs/

------------------------------------------------------------
📦 2. INSTALL DEV DEPENDENCIES
------------------------------------------------------------
Run these commands in /scripts/sync-docs:

    npm init -y
    npm install jsdom js-yaml archiver
  

------------------------------------------------------------
▶️ 3. RUNNING
------------------------------------------------------------
From repo root:
    node scripts/sync-docs/sync-docs-universal.mjs

or from /scripts/sync-docs:
    node sync-docs-universal.mjs

------------------------------------------------------------
💡  NOTES
------------------------------------------------------------
- No folder creation—ensure /scripts/sync-docs exists.
- Safe to re-run; overwrites existing outputs.
============================================================
*/

import fs from "fs";
import path from "path";
import zlib from "zlib";
import { JSDOM } from "jsdom";
import yaml from "js-yaml";
import archiver from "archiver";

// move up two levels to reach repo root
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const repoRoot = path.resolve(__dirname, "../..");

// outputs live beside the script
const outputDir = __dirname;
const outputFile = path.join(outputDir, "compiled-docs.txt");
const logFile = path.join(outputDir, "compile-log.txt");
const zipFile = `${outputFile}.zip`; // Changed from gzipFile to zipFile

const includeExts = [
  ".md", ".mdx", ".html", ".htm", ".txt",
  ".js", ".jsx", ".ts", ".tsx", ".json",
  ".yaml", ".yml"
];

const excludeDirs = [
  "node_modules", ".git", "dist", "build",
  ".next", ".astro", ".cache"
];

const skipExts = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp",
  ".mp4", ".mov", ".avi", ".zip", ".pdf",
  ".woff", ".woff2", ".ttf", ".eot", ".ico"
];

let processed = 0;
let skipped = 0;
const logEntries = [];

function safeRead(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function extractReadableContent(filePath, content) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".html" || ext === ".htm") {
    const dom = new JSDOM(content);
    const document = dom.window.document;
    document.querySelectorAll("nav, footer, header, menu, aside").forEach(el => el.remove());
    document.querySelectorAll("iframe[src*='youtube']").forEach(el => {
      const src = el.getAttribute("src");
      el.replaceWith(`[YouTube video link]: ${src}`);
    });
    return document.body?.textContent?.trim() ?? "";
  }

  if (ext === ".yaml" || ext === ".yml") {
    try {
      const parsed = yaml.load(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  if (ext === ".json") {
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  }

  return content;
}

function crawlDir(dir, output) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(repoRoot, fullPath);

    if (entry.isDirectory()) {
      if (excludeDirs.includes(entry.name)) continue;
      crawlDir(fullPath, output);
    } else {
      const ext = path.extname(entry.name).toLowerCase();

      if (skipExts.includes(ext)) {
        skipped++;
        logEntries.push(`⏭ Skipped: ${relPath}`);
        continue;
      }

      if (includeExts.includes(ext)) {
        const content = safeRead(fullPath);
        const cleaned = extractReadableContent(fullPath, content);

        if (typeof cleaned === "string" && cleaned.trim().length > 0) {
          output.push(
            `\n============================================\nFILE: ${relPath}\n============================================\n${cleaned}\n`
          );
          processed++;
          console.log(`✅ Processed: ${relPath}`);
          logEntries.push(`✅ Processed: ${relPath}`);
        } else {
          skipped++;
          logEntries.push(`⏭ Skipped (empty or invalid): ${relPath}`);
        }
      } else {
        skipped++;
        logEntries.push(`⏭ Skipped (ext): ${relPath}`);
      }
    }
  }
}

function main() {
  console.log("🧭 Starting universal docs compile...");
  const output = [];
  const start = Date.now();

  crawlDir(repoRoot, output);

  fs.writeFileSync(outputFile, output.join("\n"));
  const archive = archiver("zip", { zlib: { level: 9 } }); // Changed to use archiver for ZIP
  const outputStream = fs.createWriteStream(zipFile);
  archive.pipe(outputStream);
  archive.append(output.join("\n"), { name: "compiled-docs.txt" }); // Add content to ZIP
  archive.finalize();

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  const summary = `
🎉 Compilation complete!
✅ Files processed: ${processed}
⏭ Files skipped: ${skipped}
🕒 Duration: ${duration}s
📝 Output: ${outputFile}
🗜  Zipped: ${zipFile}
`;

  console.log(summary);
  fs.writeFileSync(logFile, [summary, ...logEntries].join("\n"));
}

main();