/**
 * Fix missing images by scanning all MDX files for image references
 * and attempting to copy the source images from the RST docs.
 * 
 * Usage: node scripts/fix-images.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const SOURCE_DIR = path.join(__dirname, '..', 'docs', 'documents', 'docs', 'source')

let stats = { missing: 0, fixed: 0, notFound: 0 }
const notFoundList = []

/**
 * Given an image path like /images/xbot/images/foo.png,
 * try to find the source file in the RST docs.
 */
function findSourceImage(imgPublicPath) {
    // imgPublicPath is like "/images/yolobit_v2/physbit/noi_dung_1/images/1.png"
    // The source would be at: SOURCE_DIR/yolobit_v2/physbit/noi_dung_1/images/1.png
    const relPath = imgPublicPath.replace(/^\/images\//, '')
    const srcPath = path.join(SOURCE_DIR, relPath)

    if (fs.existsSync(srcPath)) {
        return srcPath
    }

    // Try case-insensitive search in the parent directory
    const dirName = path.dirname(srcPath)
    const baseName = path.basename(srcPath)

    if (fs.existsSync(dirName)) {
        const entries = fs.readdirSync(dirName)
        const match = entries.find(e => e.toLowerCase() === baseName.toLowerCase())
        if (match) {
            return path.join(dirName, match)
        }
    }

    // Try "Images" instead of "images" (case mismatch)
    const altPath = srcPath.replace(/[/\\]images[/\\]/gi, (m) => {
        return m.charAt(0) + 'Images' + m.charAt(m.length - 1)
    })
    if (fs.existsSync(altPath)) {
        return altPath
    }

    // Try with "image" singular instead of "images"
    const altPath2 = srcPath.replace(/[/\\]images[/\\]/gi, (m) => {
        return m.charAt(0) + 'image' + m.charAt(m.length - 1)
    })
    if (fs.existsSync(altPath2)) {
        return altPath2
    }

    return null
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')

    // Find all image references: ![...](/images/...)
    const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g
    let match

    while ((match = imgRegex.exec(content)) !== null) {
        const imgPath = match[1]

        // Only process local images
        if (imgPath.startsWith('http') || !imgPath.startsWith('/images/')) continue

        const publicPath = path.join(PUBLIC_DIR, imgPath)

        if (!fs.existsSync(publicPath)) {
            stats.missing++

            const sourcePath = findSourceImage(imgPath)
            if (sourcePath) {
                const destDir = path.dirname(publicPath)
                fs.mkdirSync(destDir, { recursive: true })
                fs.copyFileSync(sourcePath, publicPath)
                stats.fixed++
            } else {
                stats.notFound++
                notFoundList.push(imgPath)
            }
        }
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

console.log('🔍 Scanning for missing images...')
walkDir(CONTENT_DIR)

console.log('')
console.log(`📊 Results:`)
console.log(`   Missing images found: ${stats.missing}`)
console.log(`   ✅ Fixed (copied from source): ${stats.fixed}`)
console.log(`   ❌ Not found in source: ${stats.notFound}`)

if (notFoundList.length > 0 && notFoundList.length <= 50) {
    console.log('')
    console.log('❌ Images not found:')
    for (const img of notFoundList) {
        console.log(`   ${img}`)
    }
}
