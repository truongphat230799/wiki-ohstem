/**
 * RST-to-MDX Migration Script for OhStem Wiki
 * 
 * Converts ReadTheDocs RST content to Nextra-compatible MDX files,
 * copies images, and generates _meta.js navigation files.
 * 
 * Usage: node scripts/migrate-rst.js
 */

const fs = require('fs')
const path = require('path')

const SOURCE_DIR = path.join(__dirname, '..', 'docs', 'documents', 'docs', 'source')
const CONTENT_DIR = path.join(__dirname, '..', 'content')
const PUBLIC_DIR = path.join(__dirname, '..', 'public', 'images')

// Category mapping from index.rst
const CATEGORIES = {
    store: { title: 'Cửa hàng', order: 1 },
    orc_bot: { title: 'ORC Robot Kit', order: 2 },
    yolobit_v2: { title: 'Máy tính lập trình Yolo:Bit', order: 3 },
    stem_kit: { title: 'STEM Starter Kit', order: 4 },
    aiot: { title: 'AIoT Kit - Lập trình AI & IoT', order: 5 },
    yolo_uno: { title: 'Yolo UNO - Mạch lập trình Arduino', order: 6 },
    robot_rover: { title: 'Robot STEM Rover', order: 7 },
    robot_arm: { title: 'Robot Arm', order: 8 },
    xbot: { title: 'Robot lập trình xBot', order: 9 },
    tutorials: { title: 'xBuild Creator Kit', order: 10 },
    gamekit: { title: 'Game Kit', order: 11 },
    module: { title: 'Các module mở rộng', order: 12 },
    api: { title: 'API thư viện', order: 13 },
    sa_ban: { title: 'Sa bàn thi đấu', order: 14 },
    FaQs: { title: 'FAQs', order: 15 },
    app: { title: 'Ứng dụng OhStem', order: 16 },
    board: { title: 'Board mở rộng', order: 17 },
    yolobit_v1: { title: 'Yolo:Bit v1 (Legacy)', order: 18 },
    tai_lieu_stem: { title: 'Tài liệu STEM', order: 19 },
}

let stats = { files: 0, images: 0, errors: 0 }

/**
 * Convert RST content to MDX-compatible Markdown
 */
function rstToMdx(rst, rstFilePath) {
    let md = rst

    // Remove Windows carriage returns
    md = md.replace(/\r/g, '')

    // Extract title from RST header underlines
    // Pattern: title text\n===== or -----
    let title = ''
    const titleMatch = md.match(/^\*{0,2}([^\n*]+)\*{0,2}\n[=]+\s*$/m)
    if (titleMatch) {
        title = titleMatch[1].trim().replace(/^\*\*|\*\*$/g, '')
        // Remove the title + underline (we'll use frontmatter)
        md = md.replace(/^\*{0,2}[^\n*]+\*{0,2}\n[=]+\s*$/m, '')
    }

    // Remove toctree directives entirely (navigation handled by _meta.js)
    md = md.replace(/\.\. toctree::[\s\S]*?(?=\n\S|\n\n\S|$)/g, '')

    // Convert section headers with underlines
    // --- or ~~~ = h2, ^^^ = h3, """ = h4
    md = md.replace(/^(.+)\n-{3,}\s*\n-{3,}\s*$/gm, '## $1')
    md = md.replace(/^(.+)\n-{3,}\s*$/gm, '## $1')
    md = md.replace(/^(.+)\n~{3,}\s*$/gm, '### $1')
    md = md.replace(/^(.+)\n\^{3,}\s*$/gm, '#### $1')
    md = md.replace(/^(.+)\n"{3,}\s*$/gm, '##### $1')

    // Convert RST image directives to markdown
    // Handle both .. image:: and .. figure::
    const rstDir = path.dirname(rstFilePath)
    const relativeToSource = path.relative(SOURCE_DIR, rstDir).replace(/\\/g, '/')

    md = md.replace(/\.\.\s+(image|figure)::\s*(.+?)(?:\n(?:[ \t]+:[^:]+:.*)*)/g, (match, type, imgPath) => {
        imgPath = imgPath.trim()

        // Determine source image path
        let srcImgPath
        if (imgPath.startsWith('http')) {
            return `![](${imgPath})`
        }

        srcImgPath = path.resolve(rstDir, imgPath)

        // Copy image to public directory
        const imgRelPath = relativeToSource ? `${relativeToSource}/${imgPath}` : imgPath
        const destImgPath = path.join(PUBLIC_DIR, imgRelPath.replace(/\\/g, '/'))

        try {
            const destDir = path.dirname(destImgPath)
            fs.mkdirSync(destDir, { recursive: true })
            if (fs.existsSync(srcImgPath)) {
                fs.copyFileSync(srcImgPath, destImgPath)
                stats.images++
            }
        } catch (e) {
            // Ignore copy errors silently
        }

        return `![](/images/${imgRelPath.replace(/\\/g, '/')})`
    })

    // Convert raw HTML blocks (YouTube iframes etc.)
    md = md.replace(/\.\.\s+raw::\s+html\s*\n\n([\s\S]*?)(?=\n\S|\n\n\S|$)/g, (match, html) => {
        return html.trim().split('\n').map(l => l.trim()).join('\n')
    })

    // Convert RST links: `Link text <URL>`_ → [Link text](URL)
    md = md.replace(/`([^<]+)\s*<([^>]+)>`_/g, '[$1]($2)')

    // Convert RST inline code: ``code`` → `code`
    md = md.replace(/``([^`]+)``/g, '`$1`')

    // Convert RST bold: **text** stays the same in markdown

    // Convert RST italic: *text* stays the same in markdown

    // Convert RST note/warning/tip directives
    md = md.replace(/\.\.\s+note::\s*\n([\s\S]*?)(?=\n\S|\n\n\S|$)/g, (match, content) => {
        const text = content.replace(/^[ \t]{3,}/gm, '').trim()
        return `> **Ghi chú:** ${text}\n`
    })

    md = md.replace(/\.\.\s+warning::\s*\n([\s\S]*?)(?=\n\S|\n\n\S|$)/g, (match, content) => {
        const text = content.replace(/^[ \t]{3,}/gm, '').trim()
        return `> ⚠️ **Cảnh báo:** ${text}\n`
    })

    md = md.replace(/\.\.\s+tip::\s*\n([\s\S]*?)(?=\n\S|\n\n\S|$)/g, (match, content) => {
        const text = content.replace(/^[ \t]{3,}/gm, '').trim()
        return `> 💡 **Mẹo:** ${text}\n`
    })

    md = md.replace(/\.\.\s+important::\s*\n([\s\S]*?)(?=\n\S|\n\n\S|$)/g, (match, content) => {
        const text = content.replace(/^[ \t]{3,}/gm, '').trim()
        return `> ❗ **Quan trọng:** ${text}\n`
    })

    // Convert RST code blocks
    // .. code-block:: python → ```python
    md = md.replace(/\.\.\s+code-block::\s*(\w*)\s*\n([\s\S]*?)(?=\n\S)/g, (match, lang, code) => {
        const cleanCode = code.replace(/^[ \t]{3,}/gm, (m) => m.slice(3)).trim()
        return `\`\`\`${lang}\n${cleanCode}\n\`\`\`\n`
    })

    // Remove standalone | characters (RST spacing)  
    md = md.replace(/^\|\s*$/gm, '')

    // Remove remaining RST directives we can't convert
    md = md.replace(/\.\.\s+[\w-]+::\s*.*$/gm, '')

    // Clean up excessive blank lines
    md = md.replace(/\n{4,}/g, '\n\n\n')

    // Trim
    md = md.trim()

    // Add frontmatter
    if (title) {
        md = `---\ntitle: "${title.replace(/"/g, '\\"')}"\n---\n\n# ${title}\n\n${md}`
    }

    return md
}

/**
 * Extract page titles from RST files for _meta.js generation
 */
function extractTitle(rstPath) {
    try {
        const content = fs.readFileSync(rstPath, 'utf-8')
        const titleMatch = content.match(/^\*{0,2}([^\n*]+)\*{0,2}\r?\n[=]+/m)
        if (titleMatch) {
            return titleMatch[1].trim().replace(/^\*\*|\*\*$/g, '')
        }
        // Try numbered title
        const numberedMatch = content.match(/^(\d+\.\s*.+)\r?\n[=]+/m)
        if (numberedMatch) {
            return numberedMatch[1].trim()
        }
    } catch (e) { }
    return null
}

/**
 * Parse toctree from an RST file to get child pages
 */
function parseToctree(rstContent) {
    const entries = []
    const toctreeRegex = /\.\.\s+toctree::[\s\S]*?(?=\n\S|\n\n\S|$)/g
    let match
    while ((match = toctreeRegex.exec(rstContent)) !== null) {
        const block = match[0]
        const lines = block.split('\n')
        for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed && !trimmed.startsWith('..') && !trimmed.startsWith(':') && trimmed.endsWith('.rst')) {
                entries.push(trimmed.replace('.rst', ''))
            }
        }
    }
    return entries
}

/**
 * Generate _meta.js content from a list of page entries
 */
function generateMeta(entries, sourceDir) {
    const metaObj = {}

    for (const entry of entries) {
        const parts = entry.split('/')
        const slug = parts[parts.length - 1]

        // Try to extract title from RST file
        const rstPath = path.join(sourceDir, entry + '.rst')
        let title = extractTitle(rstPath)
        if (!title) {
            // Fallback: humanize the slug
            title = slug
                .replace(/-/g, ' ')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
        }

        metaObj[slug] = title
    }

    return metaObj
}

/**
 * Process a single RST file → MDX
 */
function processRstFile(rstPath, mdxPath) {
    try {
        const content = fs.readFileSync(rstPath, 'utf-8')
        const mdx = rstToMdx(content, rstPath)

        fs.mkdirSync(path.dirname(mdxPath), { recursive: true })
        fs.writeFileSync(mdxPath, mdx, 'utf-8')
        stats.files++
    } catch (e) {
        console.error(`  ERROR: ${rstPath}: ${e.message}`)
        stats.errors++
    }
}

/**
 * Recursively process a directory of RST files
 */
function processDirectory(sourceSubDir, contentSubDir, parentSlug) {
    if (!fs.existsSync(sourceSubDir)) return

    const entries = fs.readdirSync(sourceSubDir, { withFileTypes: true })
    const rstFiles = entries.filter(e => e.isFile() && e.name.endsWith('.rst') && !e.name.startsWith('_'))
    const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.'))

    // Process RST files in this directory
    for (const file of rstFiles) {
        const rstPath = path.join(sourceSubDir, file.name)
        const slug = file.name.replace('.rst', '')

        // Check if this RST has a matching sub-directory (it's a section index)
        const matchingDir = subDirs.find(d => d.name === slug)

        if (matchingDir) {
            // This is a section index — process as index page of the subdirectory
            const subContentDir = path.join(contentSubDir, slug)
            const mdxPath = path.join(subContentDir, 'index.mdx')
            processRstFile(rstPath, mdxPath)

            // Read toctree to generate _meta.js for children
            const content = fs.readFileSync(rstPath, 'utf-8')
            const toctreeEntries = parseToctree(content)

            // Process children in the subdirectory
            processDirectory(path.join(sourceSubDir, slug), subContentDir, slug)

            // Generate _meta.js for the subdirectory
            generateMetaForDir(subContentDir, path.join(sourceSubDir, slug), toctreeEntries, slug)
        } else {
            // Regular page
            const mdxPath = path.join(contentSubDir, slug + '.mdx')
            processRstFile(rstPath, mdxPath)
        }
    }

    // Process any subdirectories that don't have a matching RST
    for (const dir of subDirs) {
        // Skip image directories
        if (/^images?$/i.test(dir.name)) continue

        const hasMatchingRst = rstFiles.some(f => f.name === dir.name + '.rst')
        if (!hasMatchingRst) {
            const subContentDir = path.join(contentSubDir, dir.name)
            processDirectory(path.join(sourceSubDir, dir.name), subContentDir, dir.name)
            generateMetaForDir(subContentDir, path.join(sourceSubDir, dir.name), [], dir.name)
        }
    }
}

/**
 * Generate _meta.js for a content directory
 */
function generateMetaForDir(contentDir, sourceDir, toctreeEntries, dirSlug) {
    if (!fs.existsSync(contentDir)) return

    const metaObj = {}

    // If we have toctree entries, use them for ordering
    if (toctreeEntries.length > 0) {
        for (const entry of toctreeEntries) {
            const parts = entry.split('/')
            const slug = parts[parts.length - 1]

            const rstPath = path.join(sourceDir, ...parts) + '.rst'
            let title = extractTitle(rstPath) || slug.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            metaObj[slug] = title
        }
    }

    // Also include any MDX files already present
    const existingFiles = fs.existsSync(contentDir) ? fs.readdirSync(contentDir) : []
    for (const f of existingFiles) {
        if (f.endsWith('.mdx') && f !== 'index.mdx') {
            const slug = f.replace('.mdx', '')
            if (!metaObj[slug]) {
                metaObj[slug] = slug.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            }
        }
        if (fs.statSync(path.join(contentDir, f)).isDirectory() && f !== 'images') {
            if (!metaObj[f]) {
                metaObj[f] = f.replace(/-/g, ' ').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            }
        }
    }

    if (Object.keys(metaObj).length > 0) {
        const metaContent = `export default ${JSON.stringify(metaObj, null, 2)}\n`
        fs.writeFileSync(path.join(contentDir, '_meta.js'), metaContent, 'utf-8')
    }
}

// ============================================
// MAIN EXECUTION
// ============================================

console.log('🚀 OhStem Wiki Migration: RST → MDX')
console.log(`   Source: ${SOURCE_DIR}`)
console.log(`   Output: ${CONTENT_DIR}`)
console.log('')

// Clean existing content (except what we want to keep)
if (fs.existsSync(CONTENT_DIR)) {
    console.log('🧹 Cleaning existing content directory...')
    fs.rmSync(CONTENT_DIR, { recursive: true, force: true })
}
fs.mkdirSync(CONTENT_DIR, { recursive: true })
fs.mkdirSync(PUBLIC_DIR, { recursive: true })

// Create homepage
const homepageMdx = `---
title: "OhStem Wiki - Trung tâm tài liệu"
---

# 🤖 Chào mừng đến OhStem Wiki

**OhStem Wiki** là trung tâm tài liệu chính thức cho tất cả sản phẩm và dịch vụ của **OhStem Education**.

## Bạn có thể tìm thấy gì ở đây?

- 📘 **Hướng dẫn sử dụng** — Từng bước thiết lập và sử dụng các thiết bị OhStem
- 💻 **Lập trình** — Hướng dẫn lập trình với Blockly, MicroPython, Arduino
- 🔧 **Sản phẩm** — Thông tin chi tiết về từng sản phẩm: Yolo:Bit, xBot, Rover...
- 🎓 **Bài học** — Giáo trình STEM theo chủ đề

## Trợ lý AI

Bạn có thể nhấn nút **"💬 Hỏi AI"** ở góc phải dưới màn hình để hỏi bất kỳ câu hỏi nào. Trợ lý AI sẽ trả lời dựa trên nội dung wiki này.
`
fs.writeFileSync(path.join(CONTENT_DIR, 'index.mdx'), homepageMdx, 'utf-8')

// Process each category from index.rst
const rootMeta = {
    index: {
        title: 'Trang chủ',
        type: 'page',
        display: 'hidden',
    }
}

console.log('📄 Processing categories...')

for (const [slug, info] of Object.entries(CATEGORIES)) {
    const sourceSubDir = path.join(SOURCE_DIR, slug)
    if (!fs.existsSync(sourceSubDir)) {
        console.log(`  ⚠️  Skipping ${slug} (not found)`)
        continue
    }

    console.log(`  📁 ${info.title} (${slug})`)

    const contentSubDir = path.join(CONTENT_DIR, slug)
    fs.mkdirSync(contentSubDir, { recursive: true })

    // Add to root meta
    rootMeta[slug] = info.title

    // Find the main RST entry point for this category
    // Look for a root-level RST that references this directory
    const mainRstFiles = fs.readdirSync(sourceSubDir)
        .filter(f => f.endsWith('.rst') && !f.startsWith('_'))

    // Process all RST files recursively
    processDirectory(sourceSubDir, contentSubDir, slug)

    // Generate _meta.js for the category root if none exists
    const metaPath = path.join(contentSubDir, '_meta.js')
    if (!fs.existsSync(metaPath)) {
        generateMetaForDir(contentSubDir, sourceSubDir, [], slug)
    }
}

// Write root _meta.js
const rootMetaContent = `export default ${JSON.stringify(rootMeta, null, 2)}\n`
fs.writeFileSync(path.join(CONTENT_DIR, '_meta.js'), rootMetaContent, 'utf-8')

console.log('')
console.log('✅ Migration complete!')
console.log(`   📄 Files converted: ${stats.files}`)
console.log(`   🖼️  Images copied: ${stats.images}`)
console.log(`   ❌ Errors: ${stats.errors}`)
