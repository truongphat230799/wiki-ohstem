import { getCurrentUser, sanitizeUser } from '../../../../../lib/auth'

export async function GET(request) {
    const user = getCurrentUser(request)
    if (!user) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    return Response.json({ user: sanitizeUser(user) })
}
