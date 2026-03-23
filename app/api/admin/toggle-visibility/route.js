import fs from 'fs'
import path from 'path'

/**
 * POST /api/admin/toggle-visibility
 * Body: { articlePath: "/section/slug", hidden: true|false }
 * Updates the _meta.js file to set display: 'hidden' or restore to normal.
 */
export async function POST(request) {
    try {
        const { articlePath, hidden } = await request.json()

        if (!articlePath || typeof hidden !== 'boolean') {
            return Response.json(
                { error: 'Thiếu thông tin. Cần articlePath và hidden.' },
                { status: 400 }
            )
        }

        // Parse path: /section/slug or /section/subsection/slug
        const parts = articlePath.replace(/^\//, '').split('/')
        if (parts.length < 2) {
            return Response.json({ error: 'Đường dẫn không hợp lệ.' }, { status: 400 })
        }

        const slug = parts[parts.length - 1]
        const dirParts = parts.slice(0, -1)
        const contentDir = path.join(process.cwd(), 'content', ...dirParts)
        const metaPath = path.join(contentDir, '_meta.js')

        if (!fs.existsSync(metaPath)) {
            return Response.json({ error: `Không tìm thấy _meta.js tại ${contentDir}` }, { status: 404 })
        }

        // Read current _meta.js
        const metaContent = fs.readFileSync(metaPath, 'utf-8')
        const match = metaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
        if (!match) {
            return Response.json({ error: 'Không thể parse _meta.js' }, { status: 500 })
        }

        let meta
        try {
            meta = new Function(`return ${match[1]}`)()
        } catch {
            return Response.json({ error: 'Không thể parse _meta.js' }, { status: 500 })
        }

        if (!(slug in meta)) {
            return Response.json({ error: `Không tìm thấy slug "${slug}" trong _meta.js` }, { status: 404 })
        }

        // Update the entry
        const currentEntry = meta[slug]

        if (hidden) {
            // Set display: 'hidden'
            if (typeof currentEntry === 'string') {
                meta[slug] = { title: currentEntry, display: 'hidden' }
            } else if (typeof currentEntry === 'object') {
                meta[slug] = { ...currentEntry, display: 'hidden' }
            }
        } else {
            // Restore to visible
            if (typeof currentEntry === 'object') {
                const { display, ...rest } = currentEntry
                // If only title remains, simplify back to string
                if (Object.keys(rest).length === 1 && rest.title) {
                    meta[slug] = rest.title
                } else {
                    meta[slug] = rest
                }
            }
        }

        // Write back _meta.js
        const newContent = `export default ${JSON.stringify(meta, null, 2)}\n`
        fs.writeFileSync(metaPath, newContent, 'utf-8')

        return Response.json({
            success: true,
            message: hidden ? `Đã ẩn bài "${slug}"` : `Đã hiện bài "${slug}"`,
        })
    } catch (error) {
        console.error('Toggle visibility error:', error)
        return Response.json({ error: 'Lỗi khi cập nhật trạng thái bài viết.' }, { status: 500 })
    }
}
