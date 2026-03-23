/**
 * Fix _meta.js files: remove entries that reference non-existent pages.
 * Usage: node scripts/fix-meta.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
let stats = { scanned: 0, fixed: 0, removed: 0 }

function fixMeta(metaPath) {
    const dir = path.dirname(metaPath)
    const content = fs.readFileSync(metaPath, 'utf-8')

    // Parse the meta object
    // Format: export default { "key": "value", ... }
    const match = content.match(/export\s+default\s+({[\s\S]*})/)
    if (!match) return

    let metaObj
    try {
        metaObj = JSON.parse(match[1])
    } catch (e) {
        // Try eval for non-JSON (e.g., unquoted keys)
        try {
            metaObj = eval('(' + match[1] + ')')
        } catch (e2) {
            console.log(`  ⚠️ Could not parse: ${metaPath}`)
            return
        }
    }

    const keysToRemove = []

    for (const key of Object.keys(metaObj)) {
        // Skip special keys
        const val = metaObj[key]
        if (typeof val === 'object' && val !== null && val.type) continue // type: 'page' etc.

        // Check if the key corresponds to an existing MDX file or directory
        const mdxPath = path.join(dir, key + '.mdx')
        const dirPath = path.join(dir, key)
        const indexPath = path.join(dir, key, 'index.mdx')

        if (!fs.existsSync(mdxPath) && !fs.existsSync(dirPath)) {
            keysToRemove.push(key)
        }
    }

    if (keysToRemove.length > 0) {
        for (const key of keysToRemove) {
            delete metaObj[key]
            stats.removed++
        }
        const newContent = `export default ${JSON.stringify(metaObj, null, 2)}\n`
        fs.writeFileSync(metaPath, newContent, 'utf-8')
        stats.fixed++
        console.log(`  ✅ ${path.relative(CONTENT_DIR, metaPath)}: removed ${keysToRemove.length} orphaned keys`)
    }

    stats.scanned++
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
            walkDir(fullPath)
        } else if (entry.name === '_meta.js') {
            fixMeta(fullPath)
        }
    }
}

console.log('🔧 Fixing _meta.js files...')
walkDir(CONTENT_DIR)
console.log(`\n✅ Scanned ${stats.scanned} meta files, fixed ${stats.fixed}, removed ${stats.removed} orphaned keys`)
