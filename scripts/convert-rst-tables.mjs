/**
 * Convert RST-style product tables to Markdown tables.
 */

import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content');
let totalConverted = 0;
const filesModified = [];

function findMdxFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMdxFiles(fullPath));
    } else if (entry.name.endsWith('.mdx') || entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function convertFile(content) {
  const lines = content.split(/\r?\n/);
  const newLines = [];
  let i = 0;
  let converted = false;

  while (i < lines.length) {
    const trimmed = lines[i].trim();

    if (trimmed === ':header-rows: 1') {
      const result = parseRstTable(lines, i);
      if (result && result.rows.length >= 2) {
        const md = buildTable(result.rows);
        newLines.push(...md);
        i = result.endIndex + 1;
        converted = true;
        continue;
      }
    }

    newLines.push(lines[i]);
    i++;
  }

  return { content: newLines.join('\n'), converted };
}

function parseRstTable(lines, startIdx) {
  let i = startIdx + 1;
  const rows = [];
  let currentRow = null;
  let lastTableLine = startIdx;

  // Skip initial empty/whitespace lines before first * -
  while (i < lines.length && (lines[i].trim() === '' || /^\s+$/.test(lines[i]))) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // New RST row: "   * - content"
    if (/^\s+\*\s*-\s/.test(line)) {
      if (currentRow) rows.push(currentRow);
      currentRow = [];
      const cellContent = trimmed.replace(/^\*\s*-\s*/, '').trim();
      if (cellContent) currentRow.push(cellContent);
      lastTableLine = i;
      i++;
      continue;
    }

    // Continuation cell: "     - content"
    if (/^\s{3,}-\s/.test(line) && currentRow !== null) {
      const cellContent = trimmed.replace(/^-\s*/, '').trim();
      if (cellContent) currentRow.push(cellContent);
      lastTableLine = i;
      i++;
      continue;
    }

    // Empty or whitespace-only lines
    if (trimmed === '' || /^\s+$/.test(line)) {
      // Peek ahead to see if more table content follows
      let peek = i + 1;
      while (peek < lines.length && (lines[peek].trim() === '' || /^\s+$/.test(lines[peek]))) {
        peek++;
      }
      if (peek < lines.length) {
        const peekLine = lines[peek];
        if (/^\s+\*\s*-\s/.test(peekLine) || (/^\s{3,}-\s/.test(peekLine) && currentRow !== null)) {
          i++;
          continue;
        }
      }
      break;
    }

    // Anything else ends the table
    break;
  }

  if (currentRow) rows.push(currentRow);
  if (rows.length < 2) return null;

  return { rows, endIndex: lastTableLine };
}

function buildTable(rows) {
  const result = [];
  const hasImages = rows[0].some(cell => /!\[.*?\]\(.*?\)/.test(cell));

  if (rows.length >= 3 && hasImages) {
    const images = rows[0];
    const names = rows[1];
    const links = rows[2];
    const count = Math.max(images.length, names.length, links.length);

    result.push('| Hình ảnh | Sản phẩm | Mua hàng |');
    result.push('|:--------:|:---------|:--------:|');
    for (let j = 0; j < count; j++) {
      result.push(`| ${images[j] || ''} | ${names[j] || ''} | ${links[j] || ''} |`);
    }
  } else if (rows.length === 2 && hasImages) {
    const images = rows[0];
    const names = rows[1];
    const count = Math.max(images.length, names.length);

    result.push('| Hình ảnh | Sản phẩm |');
    result.push('|:--------:|:---------|');
    for (let j = 0; j < count; j++) {
      result.push(`| ${images[j] || ''} | ${names[j] || ''} |`);
    }
  } else if (rows.length >= 2 && !hasImages) {
    const names = rows[0];
    const links = rows[1];
    const count = Math.max(names.length, links.length);

    result.push('| Sản phẩm | Chi tiết |');
    result.push('|:---------|:---------|');
    for (let j = 0; j < count; j++) {
      result.push(`| ${names[j] || ''} | ${links[j] || ''} |`);
    }
  }

  return result;
}

// Main
const files = findMdxFiles(contentDir);
console.log(`Found ${files.length} files to scan`);

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf-8');
  if (!content.includes(':header-rows: 1')) continue;

  const { content: newContent, converted } = convertFile(content);
  if (converted) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    const rel = path.relative(process.cwd(), filePath);
    filesModified.push(rel);
    totalConverted++;
    console.log(`✓ ${rel}`);
  }
}

console.log(`\n===== Done: ${totalConverted} files converted =====`);
