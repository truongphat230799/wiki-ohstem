/**
 * Final fix: wrap all indented code blocks in fenced code blocks.
 * This handles C/C++/JS code with angle brackets and braces.
 * Usage: node scripts/fix-indented-code.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
let stats = { scanned: 0, fixed: 0 }

function fixIndentedCode(content) {
    const lines = content.split('\n')
    const result = []
    let inFencedBlock = false
    let codeBuffer = []
    let codeIndent = 0

    function flushCodeBuffer() {
        if (codeBuffer.length === 0) return

        // Strip common indentation
        const code = codeBuffer.map(l => {
            if (l.trim() === '') return ''
            return l.substring(Math.min(codeIndent, l.search(/\S|$/)))
        }).join('\n').trim()

        if (!code) {
            codeBuffer = []
            return
        }

        // Check if this looks like actual code (has braces, #include, or angle brackets)
        const looksLikeCode = /[{}]|#include|<\w+\.h>|<\w+>|void\s|int\s|float\s|def\s|import\s|from\s|while\s|for\s|if\s*\(|function\s|const\s|let\s|var\s|class\s/.test(code)

        if (looksLikeCode) {
            // Detect language
            let lang = ''
            if (/#include|void\s+\w+\s*\(|int\s+main|Serial\.|analogRead|digitalWrite|pinMode/.test(code)) {
                lang = 'cpp'
            } else if (/def\s+\w+|import\s+\w+|from\s+\w+|print\(/.test(code)) {
                lang = 'python'
            } else if (/function\s|const\s|let\s|var\s|Math\./.test(code)) {
                lang = 'javascript'
            }

            result.push('```' + lang)
            result.push(code)
            result.push('```')
        } else {
            // Not code, keep as-is (indented)
            for (const l of codeBuffer) {
                result.push(l)
            }
        }
        codeBuffer = []
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Track fenced code blocks
        if (line.trim().startsWith('```')) {
            flushCodeBuffer()
            inFencedBlock = !inFencedBlock
            result.push(line)
            continue
        }

        if (inFencedBlock) {
            result.push(line)
            continue
        }

        // Check if line is indented (4+ spaces or tab)
        const indentMatch = line.match(/^([ \t]{4,})\S/)
        const isEmpty = line.trim() === ''

        if (indentMatch) {
            if (codeBuffer.length === 0) {
                codeIndent = indentMatch[1].length
            }
            codeBuffer.push(line)
        } else if (isEmpty && codeBuffer.length > 0) {
            // Empty line inside potential code block
            codeBuffer.push(line)
        } else {
            flushCodeBuffer()
            result.push(line)
        }
    }

    flushCodeBuffer()
    return result.join('\n')
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fixed = fixIndentedCode(content)

    if (fixed !== content) {
        fs.writeFileSync(filePath, fixed, 'utf-8')
        stats.fixed++
    }
    stats.scanned++
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) walkDir(fullPath)
        else if (entry.name.endsWith('.mdx')) processFile(fullPath)
    }
}

console.log('🔧 Fixing indented code blocks...')
walkDir(CONTENT_DIR)
console.log(`✅ Scanned ${stats.scanned} files, fixed ${stats.fixed}`)
