/**
 * sync-react-docs.js
 * Fully enhanced React docs compiler — includes snippet merging,
 * metadata, normalization, and cleanup for AI ingestion.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

const ROOT_DIR = path.resolve("../");
const DOCS_DIR = path.join(ROOT_DIR, "src/content");
const OUTPUT_FILE = path.join(process.cwd(), "compiled-react-docs.txt");

console.log("⚛️  Compiling and cleaning React documentation...");

if (!fs.existsSync(DOCS_DIR)) {
  console.error(`❌ Docs folder not found: ${DOCS_DIR}`);
  process.exit(1);
}

let output = "# React Documentation\n\n";
let fileCount = 0;
const SNIPPET_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];

// Parse YAML frontmatter (for title, etc.)
function extractFrontmatter(content) {
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return { body: content, meta: {} };
  try {
    const meta = yaml.load(match[1]);
    const body = content.replace(/^---[\s\S]*?---/, "");
    return { body, meta };
  } catch {
    return { body: content, meta: {} };
  }
}

// Merge imported snippet files
function loadSnippets(content, fullPath) {
  const imports = content.match(/['"].*snippets.*?['"]/g) || [];
  for (const match of imports) {
    const snippetPath = match.replace(/['"]/g, "");
    const absoluteSnippet = path.resolve(path.dirname(fullPath), snippetPath);

    if (fs.existsSync(absoluteSnippet)) {
      const snippetExt = path.extname(absoluteSnippet);
      if (SNIPPET_EXTENSIONS.includes(snippetExt)) {
        try {
          const snippetCode = fs.readFileSync(absoluteSnippet, "utf8");
          content += `\n\n\`\`\`js\n${snippetCode.trim()}\n\`\`\`\n`;
        } catch (err) {
          console.warn(`⚠️ Skipped snippet: ${absoluteSnippet}`, err.message);
        }
      }
    }
  }
  return content;
}

// Recursively walk directories and collect docs
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !entry.name.startsWith(".")) {
      walk(fullPath);
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      try {
        let content = fs.readFileSync(fullPath, "utf8");
        const { body, meta } = extractFrontmatter(content);
        content = body;

        // Clean up and normalize before merging
        content = content
          .replace(/import .*? from .*/g, "")
          .replace(/export const .*/g, "")
          .replace(/\{\/\*.*?\*\/\}/gs, "")
          .replace(/```(jsx|tsx|javascript|typescript)/g, "```js")
          .replace(/<.*?>/g, (tag) =>
            tag.startsWith("<code") || tag.startsWith("<pre") ? tag : ""
          );

        // Merge snippets
        content = loadSnippets(content, fullPath);

        // Build the file section
        const title = meta.title || path.basename(fullPath, path.extname(fullPath));
        output += `\n---\n# ${title}\n\n${content.trim()}\n`;
        fileCount++;
      } catch (err) {
        console.warn(`⚠️ Skipped unreadable file: ${fullPath}`, err.message);
      }
    }
  }
}

// Normalize and clean output for AI ingestion
function cleanOutput(text) {
  return (
    text
      // Remove duplicate consecutive headers (e.g., repeated "# Title")
      .replace(/(#+ .+)\n+\1/g, "$1")
      // Collapse excessive newlines (max 2)
      .replace(/\n{3,}/g, "\n\n")
      // Normalize space around section breaks
      .replace(/\n---\n+/g, "\n\n---\n\n")
      // Remove stray spaces before or after lines
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim() + "\n"
  );
}

// Run collector
walk(DOCS_DIR);

// Clean final text
output = cleanOutput(output);

fs.writeFileSync(OUTPUT_FILE, output, "utf8");

console.log(`✅ ${fileCount} Markdown pages processed and cleaned`);
console.log(`🎉 Optimized React docs written to: ${OUTPUT_FILE}`);
