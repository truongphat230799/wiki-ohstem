import { findUser, verifyPassword, createToken, updateUser, sanitizeUser } from '../../../../../lib/auth'

export async function POST(request) {
    try {
        const { username, password } = await request.json()

        if (!username || !password) {
            return Response.json({ error: 'Thiếu username hoặc password' }, { status: 400 })
        }

        const user = findUser(username)
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return Response.json({ error: 'Sai tên đăng nhập hoặc mật khẩu' }, { status: 401 })
        }

        // Update last login
        updateUser(user.id, { lastLogin: new Date().toISOString() })

        // Create JWT token
        const token = createToken(user)

        // Set cookie
        const response = Response.json({
            success: true,
            user: sanitizeUser(user),
        })

        response.headers.set(
            'Set-Cookie',
            `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}`
        )

        return response
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 })
    }
}
