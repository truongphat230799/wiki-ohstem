/**
 * Remove image references from MDX files where the image doesn't exist in public/.
 * Replaces the broken ![...](...) with a comment.
 * Usage: node scripts/remove-broken-images.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')

let fixed = 0

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    content = content.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (match, imgPath) => {
        if (imgPath.startsWith('http') || !imgPath.startsWith('/images/')) return match
        const publicPath = path.join(PUBLIC_DIR, imgPath)
        if (fs.existsSync(publicPath)) return match
        // Image doesn't exist — remove the reference
        return `{/* Image not available: ${path.basename(imgPath)} */}`
    })

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8')
        fixed++
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) walkDir(fullPath)
        else if (entry.name.endsWith('.mdx')) processFile(fullPath)
    }
}

console.log('🧹 Removing broken image references...')
walkDir(CONTENT_DIR)
console.log(`✅ Fixed ${fixed} files with broken image references`)
