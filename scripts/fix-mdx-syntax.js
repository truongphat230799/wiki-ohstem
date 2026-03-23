/**
 * Fix MDX syntax errors caused by RST conversion.
 * Handles: broken RST links, unescaped braces, angle-bracket URLs as JSX
 * Usage: node scripts/fix-mdx-syntax.js
 */

const fs = require('fs')
const path = require('path')

const CONTENT_DIR = path.join(__dirname, '..', 'content')
let stats = { scanned: 0, fixed: 0 }

function fixMdxSyntax(content) {
    let md = content

    // 1. Fix broken RST link pattern: `<URL>`_ or `<URL>[_
    // These appear as: `<https://example.com>`_ or `<https://example.com>[_
    // Convert to proper markdown links
    md = md.replace(/`<(https?:\/\/[^>]+)>`_/g, '[$1]($1)')
    md = md.replace(/`<(https?:\/\/[^>]+)>\[_/g, '[$1]($1)')

    // 2. Fix pattern: `text <URL>`_ that wasn't fully converted
    md = md.replace(/`([^<`]+)\s*<(https?:\/\/[^>]+)>`_/g, '[$1]($2)')
    md = md.replace(/`([^<`]+)\s*<(https?:\/\/[^>]+)>\[_/g, '[$1]($2)')

    // 3. Fix split RST link over 2 lines: `<URL>[_\n becomes link text ](URL)
    // Pattern: `<URL>[_ ... ](actualURL)
    md = md.replace(/`<(https?:\/\/[^>]+)>\[_\s*\n/g, '[$1]($1)\n')

    // 4. Fix remaining angle-bracket URLs that MDX treats as JSX:
    // <https://...> or <app.ohstem.vn> without backticks
    md = md.replace(/<(https?:\/\/[^\s>]+)>/g, '[$1]($1)')
    md = md.replace(/<(app\.ohstem\.vn[^\s>]*)>/g, '[app.ohstem.vn](https://$1)')
    md = md.replace(/<(docs\.ohstem\.vn[^\s>]*)>/g, '[docs.ohstem.vn](https://$1)')

    // 5. Fix indented code blocks that aren't in fenced code blocks
    // Look for 4-space-indented blocks that contain { } (C/Arduino/Python code)
    // Convert them to proper fenced code blocks
    const lines = md.split('\n')
    const result = []
    let inCodeBlock = false
    let codeBlockLines = []
    let fencedDepth = 0

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // Track fenced code blocks
        if (line.trim().startsWith('```')) {
            fencedDepth = fencedDepth === 0 ? 1 : 0
            result.push(line)
            continue
        }

        if (fencedDepth > 0) {
            result.push(line)
            continue
        }

        // Detect indented code blocks (4+ spaces)
        const isIndented = /^[ \t]{4,}\S/.test(line)
        const isEmpty = line.trim() === ''

        if (isIndented && !inCodeBlock) {
            // Start collecting indented code
            inCodeBlock = true
            codeBlockLines = [line.replace(/^[ \t]{4}/, '')]
        } else if (inCodeBlock && (isIndented || isEmpty)) {
            codeBlockLines.push(isIndented ? line.replace(/^[ \t]{4}/, '') : '')
        } else if (inCodeBlock) {
            // End of indented block
            inCodeBlock = false
            const codeContent = codeBlockLines.join('\n').trim()

            // Only wrap in fenced block if it contains braces (likely code)
            if (codeContent.includes('{') || codeContent.includes('}')) {
                // Detect language
                let lang = ''
                if (codeContent.includes('void ') || codeContent.includes('int ') ||
                    codeContent.includes('#include') || codeContent.includes('analogRead')) {
                    lang = 'cpp'
                } else if (codeContent.includes('def ') || codeContent.includes('import ')) {
                    lang = 'python'
                }
                result.push('```' + lang)
                result.push(codeContent)
                result.push('```')
            } else {
                // Not code, keep as indented (blockquote in markdown)
                for (const cl of codeBlockLines) {
                    result.push('    ' + cl)
                }
            }
            result.push(line)
            codeBlockLines = []
        } else {
            result.push(line)
        }
    }

    // Flush remaining code block
    if (inCodeBlock && codeBlockLines.length > 0) {
        const codeContent = codeBlockLines.join('\n').trim()
        if (codeContent.includes('{') || codeContent.includes('}')) {
            let lang = ''
            if (codeContent.includes('void ') || codeContent.includes('int ') ||
                codeContent.includes('#include') || codeContent.includes('analogRead')) {
                lang = 'cpp'
            } else if (codeContent.includes('def ') || codeContent.includes('import ')) {
                lang = 'python'
            }
            result.push('```' + lang)
            result.push(codeContent)
            result.push('```')
        } else {
            for (const cl of codeBlockLines) {
                result.push('    ' + cl)
            }
        }
    }

    md = result.join('\n')

    // 6. Escape remaining standalone curly braces NOT inside fenced code blocks
    // Split by code fences, only escape outside
    const parts = md.split(/(```[\s\S]*?```)/g)
    md = parts.map((part, i) => {
        // Odd indices are code blocks
        if (i % 2 === 1) return part
        // Escape { and } that appear in text (not in JSX comments)
        // Only escape if they look like standalone braces in text
        part = part.replace(/(?<!\{\/\*.*){(?!\/\*)/g, (match, offset, str) => {
            // Don't escape if inside a JSX comment or already escaped
            const before = str.substring(Math.max(0, offset - 5), offset)
            if (before.includes('{/*') || before.includes('\\{')) return match
            return '\\{'
        })
        part = part.replace(/(?<!\*\/)}/g, (match, offset, str) => {
            const before = str.substring(Math.max(0, offset - 5), offset)
            if (before.includes('*/') || before.includes('\\}')) return match
            return '\\}'
        })
        return part
    }).join('')

    // 7. Fix remaining broken `] (URL) patterns (split across lines from RST conversion)
    md = md.replace(/`\s*\]\((https?:\/\/[^)]+)\)/g, ']($1)')

    // 8. Remove orphaned backtick-bracket patterns
    md = md.replace(/`\[_\s*$/gm, '')

    return md
}

function processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fixed = fixMdxSyntax(content)

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

console.log('🔧 Fixing MDX syntax errors...')
walkDir(CONTENT_DIR)
console.log(`✅ Scanned ${stats.scanned} files, fixed ${stats.fixed}`)
