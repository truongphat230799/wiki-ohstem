import fs from 'fs'
import path from 'path'
import { revalidatePath } from 'next/cache'

/**
 * Parse _meta.js and return ordered array of keys
 */
function getMetaKeyOrder(metaPath) {
    if (!fs.existsSync(metaPath)) return []
    try {
        const content = fs.readFileSync(metaPath, 'utf-8')
        const keys = []
        // Only match top-level keys (exactly 2 spaces indent at start of line)
        const regex = /^  "([^"]+)"\s*:/gm
        let m
        while ((m = regex.exec(content)) !== null) {
            keys.push(m[1])
        }
        return keys
    } catch { return [] }
}

/**
 * Sort an array of items by their position in a key order array.
 * Items not in the order go to the end.
 */
function sortByMetaOrder(items, keyOrder, getKey) {
    const orderMap = new Map()
    keyOrder.forEach((k, i) => orderMap.set(k, i))
    return items.sort((a, b) => {
        const aIdx = orderMap.has(getKey(a)) ? orderMap.get(getKey(a)) : 9999
        const bIdx = orderMap.has(getKey(b)) ? orderMap.get(getKey(b)) : 9999
        return aIdx - bIdx
    })
}

/**
 * GET /api/admin/list-articles
 * Returns a tree of all content directories and their articles with visibility status.
 */
export async function GET() {
    try {
        const contentDir = path.join(process.cwd(), 'content')
        const sections = []

        const entries = fs.readdirSync(contentDir, { withFileTypes: true })

        for (const entry of entries) {
            if (!entry.isDirectory()) continue

            const sectionPath = path.join(contentDir, entry.name)
            const metaPath = path.join(sectionPath, '_meta.js')

            // Read _meta.js to get display titles and hidden status
            let meta = {}
            if (fs.existsSync(metaPath)) {
                const metaContent = fs.readFileSync(metaPath, 'utf-8')
                // Parse the _meta.js file (it's `export default { ... }`)
                const match = metaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
                if (match) {
                    try {
                        meta = new Function(`return ${match[1]}`)()
                    } catch { /* ignore parse errors */ }
                }
            }

            // List all .mdx and .md files in this section
            const articles = []
            const files = fs.readdirSync(sectionPath, { withFileTypes: true })

            for (const file of files) {
                if (!file.isFile()) continue
                if (!/\.(mdx?|MDX?)$/.test(file.name)) continue
                if (file.name.startsWith('_')) continue

                const slug = file.name.replace(/\.(mdx?|MDX?)$/, '')
                const metaEntry = meta[slug]

                let title = slug
                let hidden = false

                if (typeof metaEntry === 'string') {
                    title = metaEntry
                } else if (typeof metaEntry === 'object' && metaEntry !== null) {
                    title = metaEntry.title || slug
                    hidden = metaEntry.display === 'hidden'
                }

                articles.push({
                    slug,
                    title,
                    hidden,
                    file: file.name,
                    path: `/${entry.name}/${slug}`,
                })
            }

            // Also scan subdirectories (e.g., aiot/lam_quen)
            for (const subEntry of files) {
                if (!subEntry.isDirectory()) continue
                const subDir = path.join(sectionPath, subEntry.name)
                const subMetaPath = path.join(subDir, '_meta.js')

                let subMeta = {}
                if (fs.existsSync(subMetaPath)) {
                    const subMetaContent = fs.readFileSync(subMetaPath, 'utf-8')
                    const subMatch = subMetaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
                    if (subMatch) {
                        try {
                            subMeta = new Function(`return ${subMatch[1]}`)()
                        } catch { /* ignore */ }
                    }
                }

                const subFiles = fs.readdirSync(subDir, { withFileTypes: true })
                for (const sf of subFiles) {
                    if (!sf.isFile() || !/\.(mdx?|MDX?)$/.test(sf.name) || sf.name.startsWith('_')) continue
                    const subSlug = sf.name.replace(/\.(mdx?|MDX?)$/, '')
                    const subMetaEntry = subMeta[subSlug]

                    let subTitle = subSlug
                    let subHidden = false
                    if (typeof subMetaEntry === 'string') {
                        subTitle = subMetaEntry
                    } else if (typeof subMetaEntry === 'object' && subMetaEntry !== null) {
                        subTitle = subMetaEntry.title || subSlug
                        subHidden = subMetaEntry.display === 'hidden'
                    }

                    articles.push({
                        slug: subSlug,
                        title: subTitle,
                        hidden: subHidden,
                        file: sf.name,
                        path: `/${entry.name}/${subEntry.name}/${subSlug}`,
                        subSection: subEntry.name,
                    })
                }
            }

            if (articles.length > 0) {
                // Build position maps for sorting
                const sectionKeyOrder = getMetaKeyOrder(metaPath)
                const sectionOrderMap = new Map()
                sectionKeyOrder.forEach((k, i) => sectionOrderMap.set(k, i))

                // Build sub-section position maps
                const subOrderMaps = new Map()
                for (const subEntry of files) {
                    if (!subEntry.isDirectory()) continue
                    const subMetaPath = path.join(sectionPath, subEntry.name, '_meta.js')
                    const subKeyOrder = getMetaKeyOrder(subMetaPath)
                    const subMap = new Map()
                    subKeyOrder.forEach((k, i) => subMap.set(k, i))
                    subOrderMaps.set(subEntry.name, subMap)
                }

                // Sort articles: first by sub-section order in parent _meta.js, then by slug order in sub-section _meta.js
                articles.sort((a, b) => {
                    const aGroup = a.subSection || a.slug
                    const bGroup = b.subSection || b.slug
                    // Compare by section-level order first
                    const aGroupIdx = sectionOrderMap.has(aGroup) ? sectionOrderMap.get(aGroup) : 9999
                    const bGroupIdx = sectionOrderMap.has(bGroup) ? sectionOrderMap.get(bGroup) : 9999
                    if (aGroupIdx !== bGroupIdx) return aGroupIdx - bGroupIdx
                    // Same group — sort by sub-section _meta.js order
                    if (a.subSection && subOrderMaps.has(a.subSection)) {
                        const subMap = subOrderMaps.get(a.subSection)
                        const aIdx = subMap.has(a.slug) ? subMap.get(a.slug) : 9999
                        const bIdx = subMap.has(b.slug) ? subMap.get(b.slug) : 9999
                        return aIdx - bIdx
                    }
                    return 0
                })

                // Get section title from root _meta.js
                const rootMetaPath = path.join(contentDir, '_meta.js')
                let sectionTitle = entry.name
                if (fs.existsSync(rootMetaPath)) {
                    const rootMetaContent = fs.readFileSync(rootMetaPath, 'utf-8')
                    const rootMatch = rootMetaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
                    if (rootMatch) {
                        try {
                            const rootMeta = new Function(`return ${rootMatch[1]}`)()
                            if (typeof rootMeta[entry.name] === 'string') {
                                sectionTitle = rootMeta[entry.name]
                            }
                        } catch { /* ignore */ }
                    }
                }

                sections.push({
                    name: entry.name,
                    title: sectionTitle,
                    articles,
                })
            }
        }

        // Sort sections by root _meta.js key order
        const rootKeyOrder = getMetaKeyOrder(path.join(contentDir, '_meta.js'))
        sortByMetaOrder(sections, rootKeyOrder, s => s.name)

        return Response.json({ sections })
    } catch (error) {
        console.error('List articles error:', error)
        return Response.json({ error: 'Không thể liệt kê bài viết.' }, { status: 500 })
    }
}

/**
 * POST /api/admin/list-articles
 * Body: { action, ...params }
 * Consolidated handler for all admin actions.
 */
export async function POST(request) {
    try {
        const contentType = request.headers.get('content-type') || ''

        // Handle image upload (multipart/form-data)
        if (contentType.includes('multipart/form-data')) {
            return handleUpload(request)
        }

        const body = await request.json()
        const { action } = body

        switch (action) {
            case 'toggle':  return handleToggle(body)
            case 'delete':  return handleDelete(body)
            case 'read':    return handleRead(body)
            case 'save':    return handleSave(body)
            case 'create':  return handleCreate(body)
            case 'reorder': return handleReorder(body)
            default:
                return Response.json({ error: 'Action không hợp lệ.' }, { status: 400 })
        }
    } catch (error) {
        console.error('Admin action error:', error)
        return Response.json({ error: 'Lỗi khi xử lý yêu cầu.' }, { status: 500 })
    }
}

function parseMetaFile(metaPath) {
    const metaContent = fs.readFileSync(metaPath, 'utf-8')
    const match = metaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
    if (!match) return null
    try {
        return new Function(`return ${match[1]}`)()
    } catch {
        return null
    }
}

function handleToggle({ articlePath, hidden }) {
    if (!articlePath || typeof hidden !== 'boolean') {
        return Response.json({ error: 'Thiếu thông tin. Cần articlePath và hidden.' }, { status: 400 })
    }

    const parts = articlePath.replace(/^\//, '').split('/')
    if (parts.length < 2) {
        return Response.json({ error: 'Đường dẫn không hợp lệ.' }, { status: 400 })
    }

    const slug = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)
    const metaPath = path.join(contentDir, '_meta.js')

    if (!fs.existsSync(metaPath)) {
        return Response.json({ error: `Không tìm thấy _meta.js` }, { status: 404 })
    }

    const meta = parseMetaFile(metaPath)
    if (!meta) {
        return Response.json({ error: 'Không thể parse _meta.js' }, { status: 500 })
    }

    // If slug not in _meta.js, auto-add it using slug as title
    if (!(slug in meta)) {
        meta[slug] = slug
    }

    const currentEntry = meta[slug]

    if (hidden) {
        if (typeof currentEntry === 'string') {
            meta[slug] = { title: currentEntry, display: 'hidden' }
        } else if (typeof currentEntry === 'object') {
            meta[slug] = { ...currentEntry, display: 'hidden' }
        }
    } else {
        if (typeof currentEntry === 'object') {
            const { display, ...rest } = currentEntry
            if (Object.keys(rest).length === 1 && rest.title) {
                meta[slug] = rest.title
            } else {
                meta[slug] = rest
            }
        }
    }

    const newContent = `export default ${JSON.stringify(meta, null, 2)}\n`
    fs.writeFileSync(metaPath, newContent, 'utf-8')

    return Response.json({
        success: true,
        message: hidden ? `Đã ẩn bài "${slug}"` : `Đã hiện bài "${slug}"`,
    })
}

function handleDelete({ articlePath }) {
    if (!articlePath) {
        return Response.json({ error: 'Thiếu articlePath.' }, { status: 400 })
    }

    const parts = articlePath.replace(/^\//, '').split('/')
    if (parts.length < 2) {
        return Response.json({ error: 'Đường dẫn không hợp lệ.' }, { status: 400 })
    }

    const slug = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)

    let targetFile = null
    for (const ext of ['.mdx', '.md']) {
        const filePath = path.join(contentDir, slug + ext)
        if (fs.existsSync(filePath)) {
            targetFile = filePath
            break
        }
    }

    if (!targetFile) {
        return Response.json({ error: `Không tìm thấy file "${slug}"` }, { status: 404 })
    }

    fs.unlinkSync(targetFile)

    const metaPath = path.join(contentDir, '_meta.js')
    if (fs.existsSync(metaPath)) {
        const meta = parseMetaFile(metaPath)
        if (meta) {
            delete meta[slug]
            const newContent = `export default ${JSON.stringify(meta, null, 2)}\n`
            fs.writeFileSync(metaPath, newContent, 'utf-8')
        }
    }

    return Response.json({
        success: true,
        message: `Đã xóa bài "${slug}" (${path.basename(targetFile)})`,
    })
}

// ---- Read article content ----
function handleRead({ articlePath }) {
    if (!articlePath) {
        return Response.json({ error: 'Thiếu articlePath.' }, { status: 400 })
    }

    const parts = articlePath.replace(/^\//, '').split('/')
    const slug = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)

    let targetFile = null
    let content = ''
    for (const ext of ['.mdx', '.md']) {
        const filePath = path.join(contentDir, slug + ext)
        if (fs.existsSync(filePath)) {
            targetFile = filePath
            content = fs.readFileSync(filePath, 'utf-8')
            break
        }
    }

    if (!targetFile) {
        return Response.json({ error: `Không tìm thấy file "${slug}"` }, { status: 404 })
    }

    return Response.json({ content, file: path.basename(targetFile) })
}

// ---- Save article content ----
function handleSave({ articlePath, content }) {
    if (!articlePath || typeof content !== 'string') {
        return Response.json({ error: 'Thiếu articlePath hoặc content.' }, { status: 400 })
    }

    const parts = articlePath.replace(/^\//, '').split('/')
    const slug = parts[parts.length - 1]
    const dirParts = parts.slice(0, -1)
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)

    let targetFile = null
    for (const ext of ['.mdx', '.md']) {
        const filePath = path.join(contentDir, slug + ext)
        if (fs.existsSync(filePath)) {
            targetFile = filePath
            break
        }
    }

    if (!targetFile) {
        return Response.json({ error: `Không tìm thấy file "${slug}"` }, { status: 404 })
    }

    // Normalize line endings to LF
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    // Write content to disk
    fs.writeFileSync(targetFile, normalizedContent, 'utf-8')

    // Try revalidatePath for production (ISR)
    try {
        revalidatePath(articlePath)
    } catch (e) {
        // Non-critical in dev mode
    }

    return Response.json({
        success: true,
        message: `Đã lưu bài "${slug}"`,
        articlePath,
    })
}

// ---- Create new article ----
function handleCreate({ section, slug, title, content }) {
    if (!section || !slug || !title) {
        return Response.json({ error: 'Thiếu section, slug hoặc title.' }, { status: 400 })
    }

    // Sanitize slug
    const safeSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

    // Determine the target directory (supports nested like aiot/lam_quen)
    const dirParts = section.split('/')
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)

    if (!fs.existsSync(contentDir)) {
        fs.mkdirSync(contentDir, { recursive: true })
    }

    const filePath = path.join(contentDir, safeSlug + '.mdx')
    if (fs.existsSync(filePath)) {
        return Response.json({ error: `Bài "${safeSlug}" đã tồn tại trong ${section}.` }, { status: 409 })
    }

    // Write the MDX file with frontmatter
    const mdxContent = content || `---\ntitle: "${title}"\n---\n\n# ${title}\n\nNội dung bài viết...\n`
    fs.writeFileSync(filePath, mdxContent, 'utf-8')

    // Add to _meta.js
    const metaPath = path.join(contentDir, '_meta.js')
    if (fs.existsSync(metaPath)) {
        const meta = parseMetaFile(metaPath)
        if (meta) {
            meta[safeSlug] = title
            const newContent = `export default ${JSON.stringify(meta, null, 2)}\n`
            fs.writeFileSync(metaPath, newContent, 'utf-8')
        }
    } else {
        // Create a new _meta.js
        const newMeta = { [safeSlug]: title }
        fs.writeFileSync(metaPath, `export default ${JSON.stringify(newMeta, null, 2)}\n`, 'utf-8')
    }

    return Response.json({
        success: true,
        message: `Đã tạo bài "${title}" tại ${section}/${safeSlug}.mdx`,
        path: `/${section}/${safeSlug}`,
    })
}

// ---- Reorder articles in _meta.js ----
function handleReorder({ section, order }) {
    if (!section || !Array.isArray(order)) {
        return Response.json({ error: 'Thiếu section hoặc order.' }, { status: 400 })
    }

    const dirParts = section.split('/')
    const contentDir = path.join(process.cwd(), 'content', ...dirParts)
    const metaPath = path.join(contentDir, '_meta.js')

    if (!fs.existsSync(metaPath)) {
        return Response.json({ error: 'Không tìm thấy _meta.js' }, { status: 404 })
    }

    const meta = parseMetaFile(metaPath)
    if (!meta) {
        return Response.json({ error: 'Không thể parse _meta.js' }, { status: 500 })
    }

    // Rebuild meta in the new order
    const newMeta = {}
    for (const slug of order) {
        if (slug in meta) {
            newMeta[slug] = meta[slug]
        }
    }
    // Append any remaining entries not in the order array
    for (const key of Object.keys(meta)) {
        if (!(key in newMeta)) {
            newMeta[key] = meta[key]
        }
    }

    const newContent = `export default ${JSON.stringify(newMeta, null, 2)}\n`
    fs.writeFileSync(metaPath, newContent, 'utf-8')

    return Response.json({
        success: true,
        message: `Đã sắp xếp lại thứ tự trong ${section}`,
    })
}

// ---- Upload image ----
async function handleUpload(request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')
        const targetDir = formData.get('directory') || 'general'

        if (!file || typeof file === 'string') {
            return Response.json({ error: 'Không tìm thấy file upload.' }, { status: 400 })
        }

        // Sanitize filename
        const originalName = file.name
        const safeName = originalName
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')

        // Ensure target directory exists
        const uploadDir = path.join(process.cwd(), 'public', 'images', targetDir)
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true })
        }

        // Write the file
        const buffer = Buffer.from(await file.arrayBuffer())
        const filePath = path.join(uploadDir, safeName)
        fs.writeFileSync(filePath, buffer)

        const publicPath = `/images/${targetDir}/${safeName}`

        return Response.json({
            success: true,
            message: `Đã upload "${safeName}"`,
            url: publicPath,
            markdown: `![${safeName}](${publicPath})`,
        })
    } catch (error) {
        console.error('Upload error:', error)
        return Response.json({ error: 'Lỗi khi upload file.' }, { status: 500 })
    }
}
