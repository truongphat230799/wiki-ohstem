import fs from 'fs'
import path from 'path'

/**
 * POST /api/admin/delete-article
 * Body: { articlePath: "/section/slug" }
 * Deletes the .mdx file and removes the entry from _meta.js.
 */
export async function POST(request) {
    try {
        const { articlePath } = await request.json()

        if (!articlePath) {
            return Response.json({ error: 'Thiếu articlePath.' }, { status: 400 })
        }

        // Parse path: /section/slug or /section/subsection/slug
        const parts = articlePath.replace(/^\//, '').split('/')
        if (parts.length < 2) {
            return Response.json({ error: 'Đường dẫn không hợp lệ.' }, { status: 400 })
        }

        const slug = parts[parts.length - 1]
        const dirParts = parts.slice(0, -1)
        const contentDir = path.join(process.cwd(), 'content', ...dirParts)

        // Find the actual file (.md or .mdx)
        let targetFile = null
        for (const ext of ['.mdx', '.md']) {
            const filePath = path.join(contentDir, slug + ext)
            if (fs.existsSync(filePath)) {
                targetFile = filePath
                break
            }
        }

        if (!targetFile) {
            return Response.json({ error: `Không tìm thấy file "${slug}" trong ${contentDir}` }, { status: 404 })
        }

        // Delete the file
        fs.unlinkSync(targetFile)

        // Update _meta.js — remove the entry
        const metaPath = path.join(contentDir, '_meta.js')
        if (fs.existsSync(metaPath)) {
            const metaContent = fs.readFileSync(metaPath, 'utf-8')
            const match = metaContent.match(/export\s+default\s+(\{[\s\S]*\})/)
            if (match) {
                try {
                    const meta = new Function(`return ${match[1]}`)()
                    delete meta[slug]
                    const newContent = `export default ${JSON.stringify(meta, null, 2)}\n`
                    fs.writeFileSync(metaPath, newContent, 'utf-8')
                } catch { /* ignore parse errors, file is already deleted */ }
            }
        }

        return Response.json({
            success: true,
            message: `Đã xóa bài "${slug}" (${path.basename(targetFile)})`,
        })
    } catch (error) {
        console.error('Delete article error:', error)
        return Response.json({ error: 'Lỗi khi xóa bài viết.' }, { status: 500 })
    }
}
