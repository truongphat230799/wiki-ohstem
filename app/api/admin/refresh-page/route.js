import { revalidatePath } from 'next/cache'

/**
 * POST /api/admin/refresh-page
 * Revalidates a specific page path to bust Next.js cache.
 * Body: { path: '/aiot/lam_quen/bat-tat-den-rgb' }
 */
export async function POST(request) {
    try {
        const { path: pagePath } = await request.json()

        if (!pagePath) {
            return Response.json({ error: 'Thiếu path.' }, { status: 400 })
        }

        // Revalidate only the specific page. Revalidating the root layout would
        // invalidate every page on the site, forcing a full regeneration.
        try {
            revalidatePath(pagePath)
        } catch (e) {
            // In dev mode, revalidatePath may throw but the page will still be fresh
            console.warn('revalidatePath warning:', e.message)
        }

        return Response.json({
            success: true,
            message: `Đã refresh page "${pagePath}"`,
        })
    } catch (error) {
        console.error('Refresh page error:', error)
        return Response.json({ error: 'Lỗi khi refresh page.' }, { status: 500 })
    }
}
