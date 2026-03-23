/**
 * Post-process converted MDX files to clean up leftover RST artifacts.
 * Usage: node scripts/cleanup-mdx.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
let fixed = 0

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Remove leftover RST directive attributes (indented :key: value lines)
    content = content.replace(/^\s+:(width|height|align|alt|target|class|scale|name|figclass|figwidth):\s*.*$/gm, '')

    // Remove leftover RST comments
    content = content.replace(/^\.\.\s*$/gm, '')

    // Fix image paths with leftover indentation
    content = content.replace(/^(\s+)(!\[.*?\]\(.*?\))/gm, '$2')

    // Remove excessive blank lines (more than 2)
    content = content.replace(/\n{4,}/g, '\n\n\n')

    // Remove trailing whitespace on lines
    content = content.replace(/[ \t]+$/gm, '')

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8')
        fixed++
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walkDir(fullPath)
        } else if (entry.name.endsWith('.mdx')) {
            processFile(fullPath)
        }
    }
}

console.log('🧹 Cleaning up MDX files...')
walkDir(CONTENT_DIR)
console.log(`✅ Fixed ${fixed} files`)
