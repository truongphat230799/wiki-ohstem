/**
 * Resize images inside Markdown tables to 180x180 max.
 * Converts ![alt](src) in table rows to <img> tags with width constraint.
 */

import fs from 'fs';
import path from 'path';

const contentDir = path.join(process.cwd(), 'content');
let totalConverted = 0;

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

function processFile(content) {
  const lines = content.split(/\r?\n/);
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Only process lines that are table rows (start with |)
    if (!line.trimStart().startsWith('|')) continue;
    
    // Replace ![alt](src) with <img> tag inside table cells
    const newLine = line.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (match, alt, src) => {
        return `<img src="${src}" alt="${alt}" width="180" />`;
      }
    );
    
    if (newLine !== line) {
      lines[i] = newLine;
      changed = true;
    }
  }

  return { content: lines.join('\n'), changed };
}

// Main
const files = findMdxFiles(contentDir);
console.log(`Scanning ${files.length} files...`);

for (const filePath of files) {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Only process files that have our table format
  if (!content.includes('| Hình ảnh |')) continue;
  
  const { content: newContent, changed } = processFile(content);
  if (changed) {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    const rel = path.relative(process.cwd(), filePath);
    totalConverted++;
    console.log(`✓ ${rel}`);
  }
}

console.log(`\n===== Done: ${totalConverted} files updated =====`);
