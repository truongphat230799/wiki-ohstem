/**
 * Fix missing images by searching the ENTIRE RST source for matching filenames.
 * Usage: node scripts/fix-images-v2.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const SOURCE_DIR = path.join(__dirname, '..', 'docs', 'documents', 'docs', 'source')

// Step 1: Build an index of ALL image files in the RST source
console.log('🔍 Building image index from RST source...')
const imageIndex = new Map() // filename -> [fullPath, ...]

function indexImages(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            indexImages(fullPath)
        } else if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(entry.name)) {
            const key = entry.name.toLowerCase()
            if (!imageIndex.has(key)) imageIndex.set(key, [])
            imageIndex.get(key).push(fullPath)
        }
    }
}
indexImages(SOURCE_DIR)
console.log(`   Indexed ${imageIndex.size} unique image filenames`)

// Step 2: Scan all MDX files for missing images
console.log('🔍 Scanning MDX files for missing images...')
let missing = 0, fixed = 0, stillMissing = 0
const notFoundList = []

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf-8')
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    let match
    let modified = false

    while ((match = imgRegex.exec(content)) !== null) {
        const imgPath = match[1]
        if (imgPath.startsWith('http') || !imgPath.startsWith('/images/')) continue

        const publicPath = path.join(PUBLIC_DIR, imgPath)
        if (fs.existsSync(publicPath)) continue

        missing++
        const baseName = path.basename(imgPath).toLowerCase()
        const candidates = imageIndex.get(baseName) || []

        if (candidates.length > 0) {
            // Pick best candidate: prefer one whose path partially matches the MDX path
            const mdxRelDir = path.relative(CONTENT_DIR, path.dirname(filePath)).replace(/\\/g, '/')
            let bestCandidate = candidates[0]

            for (const c of candidates) {
                const cRel = path.relative(SOURCE_DIR, c).replace(/\\/g, '/')
                if (cRel.includes(mdxRelDir.split('/')[0])) {
                    bestCandidate = c
                    break
                }
            }

            const destDir = path.dirname(publicPath)
            fs.mkdirSync(destDir, { recursive: true })
            fs.copyFileSync(bestCandidate, publicPath)
            fixed++
        } else {
            stillMissing++
            if (!notFoundList.includes(imgPath)) notFoundList.push(imgPath)
        }
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

walkDir(CONTENT_DIR)

console.log('')
console.log(`📊 Results:`)
console.log(`   Missing images found: ${missing}`)
console.log(`   ✅ Fixed: ${fixed}`)
console.log(`   ❌ Still missing: ${stillMissing}`)

if (notFoundList.length > 0) {
    console.log('')
    console.log('❌ Images not found anywhere in source:')
    for (const img of notFoundList) {
        console.log(`   ${img}`)
    }
}
