import { getCurrentUser, getUsers, createUser, sanitizeUser } from '../../../../lib/auth'

// GET: List all users (level1 only)
export async function GET(request) {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    if (currentUser.role !== 'level1') {
        return Response.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const users = getUsers().map(sanitizeUser)
    return Response.json({ users })
}

// POST: Create new user (level1 only)
export async function POST(request) {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    if (currentUser.role !== 'level1') {
        return Response.json({ error: 'Không có quyền tạo tài khoản' }, { status: 403 })
    }

    try {
        const { username, password, displayName } = await request.json()
        if (!username || !password) {
            return Response.json({ error: 'Thiếu username hoặc password' }, { status: 400 })
        }
        if (password.length < 3) {
            return Response.json({ error: 'Password phải có ít nhất 3 ký tự' }, { status: 400 })
        }

        // Level1 can only create level2 accounts
        const newUser = createUser({
            username,
            password,
            displayName,
            role: 'level2',
        })

        return Response.json({
            success: true,
            message: `Đã tạo tài khoản "${username}"`,
            user: sanitizeUser(newUser),
        })
    } catch (err) {
        return Response.json({ error: err.message }, { status: 400 })
    }
}
