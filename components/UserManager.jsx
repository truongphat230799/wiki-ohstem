'use client'

import { useState, useEffect, useCallback } from 'react'

export default function UserManager({ onClose }) {
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [toast, setToast] = useState(null)

    // New user form
    const [showCreate, setShowCreate] = useState(false)
    const [newUsername, setNewUsername] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [newDisplayName, setNewDisplayName] = useState('')
    const [creating, setCreating] = useState(false)

    // Confirm delete
    const [confirmDelete, setConfirmDelete] = useState(null)

    // Edit password
    const [editPasswordId, setEditPasswordId] = useState(null)
    const [newPwd, setNewPwd] = useState('')

    const showToastMsg = useCallback((msg, type = 'success') => {
        setToast({ message: msg, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/admin/users')
            if (!res.ok) throw new Error('Không thể tải danh sách tài khoản')
            const data = await res.json()
            setUsers(data.users || [])
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchUsers() }, [fetchUsers])

    const handleCreateUser = async (e) => {
        e.preventDefault()
        setCreating(true)
        try {
            const res = await fetch('/api/admin/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: newUsername,
                    password: newPassword,
                    displayName: newDisplayName || newUsername,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToastMsg(data.message)
            setShowCreate(false)
            setNewUsername('')
            setNewPassword('')
            setNewDisplayName('')
            await fetchUsers()
        } catch (err) {
            showToastMsg(err.message, 'error')
        } finally {
            setCreating(false)
        }
    }

    const handleDelete = async (id) => {
        try {
            const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToastMsg(data.message)
            setConfirmDelete(null)
            await fetchUsers()
        } catch (err) {
            showToastMsg(err.message, 'error')
        }
    }

    const handleChangeRole = async (id, newRole) => {
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToastMsg(data.message)
            await fetchUsers()
        } catch (err) {
            showToastMsg(err.message, 'error')
        }
    }

    const handleResetPassword = async (id) => {
        if (!newPwd || newPwd.length < 3) {
            showToastMsg('Password phải có ít nhất 3 ký tự', 'error')
            return
        }
        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: newPwd }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToastMsg('Đã đổi mật khẩu')
            setEditPasswordId(null)
            setNewPwd('')
        } catch (err) {
            showToastMsg(err.message, 'error')
        }
    }

    const roleLabel = (role) => role === 'level1' ? '⭐ Admin Level 1' : '✏️ Admin Level 2'
    const roleColor = (role) => role === 'level1' ? '#f59e0b' : '#6366f1'

    return (
        <div style={s.overlay}>
            <div style={s.modal}>
                {/* Header */}
                <div style={s.header}>
                    <h2 style={s.headerTitle}>👥 Quản lý tài khoản</h2>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowCreate(!showCreate)} style={s.createBtn}>
                            {showCreate ? '✕ Đóng' : '➕ Tạo tài khoản'}
                        </button>
                        <button onClick={onClose} style={s.closeBtn}>✕</button>
                    </div>
                </div>

                {/* Toast */}
                {toast && (
                    <div style={{
                        ...s.toast,
                        background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                        color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                        borderColor: toast.type === 'error' ? '#fecaca' : '#bbf7d0',
                    }}>
                        {toast.message}
                    </div>
                )}

                {/* Create Form */}
                {showCreate && (
                    <form onSubmit={handleCreateUser} style={s.createForm}>
                        <h3 style={{ margin: '0 0 12px', fontSize: '15px', color: '#1e293b' }}>Tạo tài khoản mới (Level 2)</h3>
                        <div style={s.formRow}>
                            <input
                                placeholder="Username *"
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                required
                                style={s.formInput}
                            />
                            <input
                                type="password"
                                placeholder="Password *"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                                style={s.formInput}
                            />
                            <input
                                placeholder="Tên hiển thị"
                                value={newDisplayName}
                                onChange={(e) => setNewDisplayName(e.target.value)}
                                style={s.formInput}
                            />
                            <button type="submit" disabled={creating} style={s.submitBtn}>
                                {creating ? '⏳' : '✓ Tạo'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Users Table */}
                {loading ? (
                    <div style={s.loadingWrap}>⏳ Đang tải...</div>
                ) : error ? (
                    <div style={{ ...s.toast, background: '#fef2f2', color: '#dc2626' }}>{error}</div>
                ) : (
                    <div style={s.tableWrap}>
                        <table style={s.table}>
                            <thead>
                                <tr>
                                    <th style={s.th}>Username</th>
                                    <th style={s.th}>Tên hiển thị</th>
                                    <th style={s.th}>Quyền</th>
                                    <th style={s.th}>Ngày tạo</th>
                                    <th style={s.th}>Lần cuối login</th>
                                    <th style={s.th}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id} style={s.tr}>
                                        <td style={s.td}>
                                            <strong>{user.username}</strong>
                                        </td>
                                        <td style={s.td}>{user.displayName}</td>
                                        <td style={s.td}>
                                            <span style={{ ...s.badge, background: roleColor(user.role) + '20', color: roleColor(user.role) }}>
                                                {roleLabel(user.role)}
                                            </span>
                                        </td>
                                        <td style={s.td}>
                                            <span style={s.dateText}>{new Date(user.createdAt).toLocaleDateString('vi')}</span>
                                        </td>
                                        <td style={s.td}>
                                            <span style={s.dateText}>
                                                {user.lastLogin ? new Date(user.lastLogin).toLocaleString('vi') : '—'}
                                            </span>
                                        </td>
                                        <td style={s.td}>
                                            {user.role === 'level1' ? (
                                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>Protected</span>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                    <button
                                                        onClick={() => {
                                                            setEditPasswordId(editPasswordId === user.id ? null : user.id)
                                                            setNewPwd('')
                                                        }}
                                                        style={s.actionBtn}
                                                        title="Đổi mật khẩu"
                                                    >
                                                        🔑
                                                    </button>
                                                    <button
                                                        onClick={() => handleChangeRole(user.id, user.role === 'level2' ? 'level1' : 'level2')}
                                                        style={s.actionBtn}
                                                        title={user.role === 'level2' ? 'Nâng lên Level 1' : 'Hạ xuống Level 2'}
                                                    >
                                                        {user.role === 'level2' ? '⬆️' : '⬇️'}
                                                    </button>
                                                    {confirmDelete === user.id ? (
                                                        <>
                                                            <button onClick={() => handleDelete(user.id)} style={{ ...s.actionBtn, background: '#dc2626', color: 'white' }}>
                                                                Xóa!
                                                            </button>
                                                            <button onClick={() => setConfirmDelete(null)} style={s.actionBtn}>
                                                                Hủy
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmDelete(user.id)}
                                                            style={{ ...s.actionBtn, color: '#dc2626' }}
                                                            title="Xóa tài khoản"
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            {/* Password reset inline */}
                                            {editPasswordId === user.id && (
                                                <div style={{ display: 'flex', gap: '4px', marginTop: '6px' }}>
                                                    <input
                                                        type="password"
                                                        placeholder="Mật khẩu mới"
                                                        value={newPwd}
                                                        onChange={(e) => setNewPwd(e.target.value)}
                                                        style={{ ...s.formInput, flex: 1, fontSize: '12px', padding: '4px 8px' }}
                                                    />
                                                    <button onClick={() => handleResetPassword(user.id)} style={{ ...s.actionBtn, background: '#6366f1', color: 'white' }}>
                                                        ✓
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}

const s = {
    overlay: {
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    },
    modal: {
        background: 'white', borderRadius: '16px', width: '100%', maxWidth: '900px',
        maxHeight: '85vh', overflow: 'auto', boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
    },
    header: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
        position: 'sticky', top: 0, background: 'white', zIndex: 10, borderRadius: '16px 16px 0 0',
    },
    headerTitle: { margin: 0, fontSize: '18px', color: '#1e293b' },
    createBtn: {
        padding: '8px 16px', borderRadius: '8px', border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
        fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    },
    closeBtn: {
        width: '36px', height: '36px', borderRadius: '8px', border: '1px solid #e5e7eb',
        background: 'white', fontSize: '16px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
    },
    toast: {
        margin: '12px 24px', padding: '10px 16px', borderRadius: '8px',
        fontSize: '13px', border: '1px solid',
    },
    createForm: {
        margin: '16px 24px', padding: '16px', background: '#f8fafc',
        borderRadius: '12px', border: '1px solid #e2e8f0',
    },
    formRow: {
        display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center',
    },
    formInput: {
        padding: '8px 12px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
        fontSize: '13px', flex: 1, minWidth: '120px', fontFamily: 'inherit',
    },
    submitBtn: {
        padding: '8px 20px', borderRadius: '8px', border: 'none',
        background: '#16a34a', color: 'white', fontSize: '13px',
        fontWeight: '600', cursor: 'pointer',
    },
    loadingWrap: {
        padding: '40px', textAlign: 'center', color: '#6b7280',
    },
    tableWrap: { padding: '16px 24px 24px' },
    table: {
        width: '100%', borderCollapse: 'collapse', fontSize: '13px',
    },
    th: {
        textAlign: 'left', padding: '10px 12px', borderBottom: '2px solid #e5e7eb',
        color: '#64748b', fontWeight: '600', fontSize: '12px', textTransform: 'uppercase',
    },
    tr: { borderBottom: '1px solid #f1f5f9' },
    td: { padding: '12px', verticalAlign: 'top' },
    badge: {
        display: 'inline-block', padding: '3px 10px', borderRadius: '6px',
        fontSize: '12px', fontWeight: '600',
    },
    dateText: { fontSize: '12px', color: '#94a3b8' },
    actionBtn: {
        padding: '4px 8px', borderRadius: '6px', border: '1px solid #e5e7eb',
        background: '#f8fafc', fontSize: '12px', cursor: 'pointer',
    },
}
