import { getCurrentUser, updateUser, deleteUser, findUserById, sanitizeUser } from '../../../../../lib/auth'

// PUT: Update user (level1 only)
export async function PUT(request, { params }) {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    if (currentUser.role !== 'level1') {
        return Response.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { id } = await params
    const targetUser = findUserById(id)
    if (!targetUser) {
        return Response.json({ error: 'Không tìm thấy user' }, { status: 404 })
    }

    try {
        const body = await request.json()
        const updates = {}

        if (body.password) updates.password = body.password
        if (body.displayName !== undefined) updates.displayName = body.displayName
        if (body.role !== undefined) {
            // Only allow level1 and level2 roles
            if (!['level1', 'level2'].includes(body.role)) {
                return Response.json({ error: 'Role không hợp lệ' }, { status: 400 })
            }
            updates.role = body.role
        }

        const updated = updateUser(id, updates)
        return Response.json({
            success: true,
            message: `Đã cập nhật "${targetUser.username}"`,
            user: sanitizeUser(updated),
        })
    } catch (err) {
        return Response.json({ error: err.message }, { status: 400 })
    }
}

// DELETE: Delete user (level1 only)
export async function DELETE(request, { params }) {
    const currentUser = getCurrentUser(request)
    if (!currentUser) {
        return Response.json({ error: 'Chưa đăng nhập' }, { status: 401 })
    }
    if (currentUser.role !== 'level1') {
        return Response.json({ error: 'Không có quyền' }, { status: 403 })
    }

    const { id } = await params

    // Cannot delete yourself
    if (id === currentUser.id) {
        return Response.json({ error: 'Không thể xóa chính mình' }, { status: 400 })
    }

    const targetUser = findUserById(id)
    if (!targetUser) {
        return Response.json({ error: 'Không tìm thấy user' }, { status: 404 })
    }

    try {
        deleteUser(id)
        return Response.json({
            success: true,
            message: `Đã xóa tài khoản "${targetUser.username}"`,
        })
    } catch (err) {
        return Response.json({ error: err.message }, { status: 400 })
    }
}
