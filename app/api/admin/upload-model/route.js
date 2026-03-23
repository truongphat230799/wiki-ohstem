import { getCurrentUser } from '../../../../lib/auth'
import fs from 'fs'
import path from 'path'

const MODELS_DIR = path.join(process.cwd(), 'public', 'models')

// GET: List uploaded models
export async function GET(request) {
    const user = getCurrentUser(request)
    if (!user) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    // Ensure directory exists
    if (!fs.existsSync(MODELS_DIR)) {
        fs.mkdirSync(MODELS_DIR, { recursive: true })
    }

    const files = fs.readdirSync(MODELS_DIR)
        .filter(f => /\.(glb|gltf)$/i.test(f))
        .map(f => {
            const stat = fs.statSync(path.join(MODELS_DIR, f))
            return {
                name: f,
                src: `/models/${f}`,
                size: stat.size,
                uploaded: stat.mtime.toISOString(),
            }
        })
        .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))

    return Response.json({ models: files })
}

// POST: Upload a GLB/GLTF model file
export async function POST(request) {
    const user = getCurrentUser(request)
    if (!user) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }

    try {
        const formData = await request.formData()
        const file = formData.get('file')

        if (!file || typeof file === 'string') {
            return Response.json({ error: 'Chưa chọn file' }, { status: 400 })
        }

        // Validate extension
        const name = file.name.toLowerCase()
        if (!name.endsWith('.glb') && !name.endsWith('.gltf')) {
            return Response.json({ error: 'Chỉ chấp nhận file .glb hoặc .gltf' }, { status: 400 })
        }

        // Validate size (max 50MB)
        if (file.size > 50 * 1024 * 1024) {
            return Response.json({ error: 'File quá lớn (tối đa 50MB)' }, { status: 400 })
        }

        // Ensure directory exists
        if (!fs.existsSync(MODELS_DIR)) {
            fs.mkdirSync(MODELS_DIR, { recursive: true })
        }

        // Sanitize filename
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const targetPath = path.join(MODELS_DIR, safeName)

        // Write file
        const buffer = Buffer.from(await file.arrayBuffer())
        fs.writeFileSync(targetPath, buffer)

        return Response.json({
            success: true,
            message: `Đã upload "${safeName}"`,
            model: {
                name: safeName,
                src: `/models/${safeName}`,
                size: buffer.length,
            },
        })
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 })
    }
}
