/**
 * Rename uppercase image extensions to lowercase and update MDX references.
 * Fixes: .JPG → .jpg, .PNG → .png, .JPEG → .jpeg, .GIF → .gif
 * Usage: node scripts/fix-extensions.js
 */

const fs = require('fs')
const path = require('path')

const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images')
const CONTENT_DIR = path.join(__dirname, '..', 'content')

let renamedFiles = 0
let updatedMdx = 0

// Step 1: Rename all uppercase extension files
console.log('🔧 Renaming uppercase image extensions...')

function renameFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            renameFiles(fullPath)
        } else {
            const ext = path.extname(entry.name)
            const lowerExt = ext.toLowerCase()
            if (ext !== lowerExt && ['.jpg', '.png', '.jpeg', '.gif', '.svg', '.webp', '.bmp'].includes(lowerExt)) {
                const newName = path.basename(entry.name, ext) + lowerExt
                const newPath = path.join(dir, newName)
                fs.renameSync(fullPath, newPath)
                renamedFiles++
            }
        }
    }
}

renameFiles(PUBLIC_DIR)
console.log(`   Renamed ${renamedFiles} files`)

// Step 2: Update MDX references to use lowercase extensions
console.log('🔧 Updating MDX references...')

function updateMdxFiles(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            updateMdxFiles(fullPath)
        } else if (entry.name.endsWith('.mdx')) {
            let content = fs.readFileSync(fullPath, 'utf-8')
            const original = content

            // Replace uppercase extensions in image references
            content = content.replace(/\.(JPG|JPEG|PNG|GIF|SVG|WEBP|BMP)\b/g, (match) => match.toLowerCase())

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf-8')
                updatedMdx++
            }
        }
    }
}

updateMdxFiles(CONTENT_DIR)
console.log(`   Updated ${updatedMdx} MDX files`)
console.log('\n✅ Done!')
