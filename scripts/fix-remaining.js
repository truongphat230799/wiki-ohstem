/**
 * Scan specific broken MDX files and report problematic lines.
 * Then apply targeted fixes.
 * Usage: node scripts/fix-remaining.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')

const brokenFiles = [
    'api/api-xbot/arduino-api/ir_receiver.mdx',
    'api/api-xbot/micropython-api/motion.mdx',
    'api/api-xbot/micropython-api/oled_i2c.mdx',
    'app/block-api/api-input/block_input_selected_value.mdx',
    'gamekit/gamekit/chu-chay.mdx',
    'module/cam-bien/color.mdx',
    'module/cam-bien/gps.mdx',
    'module/cam-bien/hx711.mdx',
    'module/cam-bien/line-2-mat.mdx',
    'module/cam-bien/line-4-mat.mdx',
    'robot_rover/gamepad.mdx',
    'xbot/gamepad-xbot.mdx',
    'yolo_uno/yolo_uno_khoi_lenh/cam_bien/gps_ATGM336H.mdx',
]

let fixed = 0

for (const relPath of brokenFiles) {
    const filePath = path.join(CONTENT_DIR, relPath)
    if (!fs.existsSync(filePath)) {
        console.log(`  SKIP: ${relPath} (not found)`)
        continue
    }

    let content = fs.readFileSync(filePath, 'utf-8')
    const original = content

    // Fix 1: Escape < followed by letters/numbers that look like HTML tags but aren't
    // e.g. <2 becomes &lt;2, <IR_RECEIVE becomes &lt;IR_RECEIVE
    // But preserve actual HTML like <iframe>, <br>, <img>, etc.
    const validHtmlTags = ['iframe', 'br', 'img', 'div', 'span', 'p', 'a', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th', 'pre', 'code', 'blockquote', 'hr', 'sup', 'sub']

    // Process line by line, skip fenced code blocks
    const lines = content.split('\n')
    let inFence = false
    const fixedLines = []

    for (const line of lines) {
        if (line.trim().startsWith('```')) {
            inFence = !inFence
            fixedLines.push(line)
            continue
        }
        if (inFence) {
            fixedLines.push(line)
            continue
        }

        let fixedLine = line

        // Fix angle brackets that look like JSX but aren't valid HTML/JSX
        fixedLine = fixedLine.replace(/<([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)(?=[^>]*(?:\/|$))/g, (match, tag) => {
            const tagLower = tag.toLowerCase()
            // Keep valid HTML tags and known components
            if (validHtmlTags.includes(tagLower)) return match
            // Keep JSX comments
            if (tag === '!--') return match
            // Escape it
            return '\\<' + tag
        })

        // Fix <NUMBER pattern (e.g., <2, <10)
        fixedLine = fixedLine.replace(/<(\d)/g, '\\<$1')

        // Fix </tag patterns that don't match valid HTML
        fixedLine = fixedLine.replace(/<\/([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)>/g, (match, tag) => {
            const tagLower = tag.toLowerCase()
            if (validHtmlTags.includes(tagLower)) return match
            return '\\</' + tag + '>'
        })

        fixedLines.push(fixedLine)
    }

    content = fixedLines.join('\n')

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf-8')
        fixed++
        console.log(`  ✅ Fixed: ${relPath}`)
    } else {
        // If no fix was applied, let's look at what's wrong
        console.log(`  ⚠️  No regex match: ${relPath} — scanning for issues...`)
        const lines2 = content.split('\n')
        let inFence2 = false
        for (let i = 0; i < lines2.length; i++) {
            const l = lines2[i]
            if (l.trim().startsWith('```')) { inFence2 = !inFence2; continue }
            if (inFence2) continue
            if (/<[a-zA-Z0-9]/.test(l) && !l.includes('iframe') && !l.includes('![')) {
                console.log(`    L${i + 1}: ${l.substring(0, 150)}`)
            }
        }
    }
}

console.log(`\n✅ Fixed ${fixed} of ${brokenFiles.length} files`)
