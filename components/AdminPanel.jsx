'use client'

import { useState, useEffect, useCallback } from 'react'
import ArticleEditor from './ArticleEditor'
import CreateArticle from './CreateArticle'
import UserManager from './UserManager'
import './AdminPanel.css'

export default function AdminPanel() {
    const [sections, setSections] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [actionLoading, setActionLoading] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [toast, setToast] = useState(null)

    // New states for CMS features
    const [editingArticle, setEditingArticle] = useState(null)
    const [showCreate, setShowCreate] = useState(false)
    const [reorderSection, setReorderSection] = useState(null)
    const [reorderList, setReorderList] = useState([])

    // Auth states
    const [currentUser, setCurrentUser] = useState(null)
    const [showUserManager, setShowUserManager] = useState(false)

    const showToast = useCallback((message, type = 'success') => {
        setToast({ message, type })
        setTimeout(() => setToast(null), 3000)
    }, [])

    const fetchArticles = useCallback(async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/admin/list-articles')
            if (!res.ok) throw new Error('Không thể tải danh sách bài viết')
            const data = await res.json()
            setSections(data.sections || [])
            setError(null)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch current user on mount
    useEffect(() => {
        fetch('/api/admin/auth/me')
            .then(r => r.json())
            .then(d => { if (d.user) setCurrentUser(d.user) })
            .catch(() => {})
    }, [])

    useEffect(() => {
        fetchArticles()
    }, [fetchArticles])

    const handleLogout = async () => {
        await fetch('/api/admin/auth/logout', { method: 'POST' })
        window.location.href = '/admin/login'
    }

    const isLevel1 = currentUser?.role === 'level1'

    const handleToggleVisibility = async (articlePath, currentHidden) => {
        setActionLoading(articlePath)
        try {
            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle', articlePath, hidden: !currentHidden }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast(data.message)
            await fetchArticles()
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    const handleDelete = async (articlePath) => {
        setActionLoading(articlePath)
        setConfirmDelete(null)
        try {
            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', articlePath }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast(data.message)
            await fetchArticles()
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // ---- Reorder functions ----
    const startReorder = (section) => {
        setReorderSection(section.name)
        // Build the order from this section's articles (only articles in the direct section, not subsections)
        const directArticles = section.articles.filter(a => !a.subSection)
        setReorderList(directArticles.map(a => ({ slug: a.slug, title: a.title })))
    }

    const moveItem = (index, direction) => {
        const newList = [...reorderList]
        const targetIndex = index + direction
        if (targetIndex < 0 || targetIndex >= newList.length) return
        ;[newList[index], newList[targetIndex]] = [newList[targetIndex], newList[index]]
        setReorderList(newList)
    }

    const saveReorder = async () => {
        setActionLoading('reorder')
        try {
            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'reorder',
                    section: reorderSection,
                    order: reorderList.map(item => item.slug),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast(data.message)
            setReorderSection(null)
            setReorderList([])
            await fetchArticles()
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setActionLoading(null)
        }
    }

    // Filter articles by search query
    const filteredSections = sections
        .map((section) => ({
            ...section,
            articles: section.articles.filter(
                (a) =>
                    a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    a.path.toLowerCase().includes(searchQuery.toLowerCase())
            ),
        }))
        .filter((s) => s.articles.length > 0)

    // Stats
    const totalArticles = sections.reduce((acc, s) => acc + s.articles.length, 0)
    const hiddenArticles = sections.reduce(
        (acc, s) => acc + s.articles.filter((a) => a.hidden).length,
        0
    )

    return (
        <div className="admin-panel">
            {/* Auth Header Bar */}
            {currentUser && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b, #334155)',
                    color: 'white',
                    padding: '10px 24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '13px',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '16px' }}>🛡️</span>
                        <span>
                            Xin chào, <strong>{currentUser.displayName}</strong>
                        </span>
                        <span style={{
                            background: currentUser.role === 'level1' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)',
                            color: currentUser.role === 'level1' ? '#fbbf24' : '#a5b4fc',
                            padding: '2px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '600',
                        }}>
                            {currentUser.role === 'level1' ? '⭐ Level 1' : '✏️ Level 2'}
                        </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        {isLevel1 && (
                            <button
                                onClick={() => setShowUserManager(true)}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'white',
                                    padding: '6px 14px',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    cursor: 'pointer',
                                }}
                            >
                                👥 Quản lý tài khoản
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'rgba(220,38,38,0.2)',
                                border: '1px solid rgba(220,38,38,0.3)',
                                color: '#fca5a5',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                cursor: 'pointer',
                            }}
                        >
                            🚪 Đăng xuất
                        </button>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="admin-header">
                <div className="admin-header__info">
                    <h1>📋 Quản lý bài viết</h1>
                    <p>Chỉnh sửa, thêm mới, ẩn, xóa, sắp xếp bài viết <em>(thay đổi sidebar cần reload trang)</em></p>
                </div>
                <div className="admin-header__right">
                    <div className="admin-header__stats">
                        <div className="admin-stat">
                            <span className="admin-stat__number">{totalArticles}</span>
                            <span className="admin-stat__label">Tổng bài</span>
                        </div>
                        <div className="admin-stat admin-stat--hidden">
                            <span className="admin-stat__number">{hiddenArticles}</span>
                            <span className="admin-stat__label">Đang ẩn</span>
                        </div>
                        <div className="admin-stat admin-stat--visible">
                            <span className="admin-stat__number">{totalArticles - hiddenArticles}</span>
                            <span className="admin-stat__label">Đang hiện</span>
                        </div>
                    </div>
                    <button
                        className="admin-btn-primary"
                        style={{ background: 'linear-gradient(135deg, #0f766e, #0ea5e9)' }}
                        onClick={() => {
                            window.location.href = '/admin/ai-chat'
                        }}
                    >
                        ðŸ¤– AI Chat
                    </button>
                    <button className="admin-btn-primary" onClick={() => setShowCreate(true)}>
                        ➕ Thêm bài mới
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="admin-search">
                <svg className="admin-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    placeholder="Tìm kiếm bài viết..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="admin-search__input"
                />
                {searchQuery && (
                    <button className="admin-search__clear" onClick={() => setSearchQuery('')}>
                        ✕
                    </button>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="admin-loading">
                    <div className="admin-spinner" />
                    <p>Đang tải danh sách bài viết...</p>
                </div>
            ) : error ? (
                <div className="admin-error">
                    <p>⚠️ {error}</p>
                    <button onClick={fetchArticles}>Thử lại</button>
                </div>
            ) : filteredSections.length === 0 ? (
                <div className="admin-empty">
                    <p>🔍 Không tìm thấy bài viết nào{searchQuery ? ` cho "${searchQuery}"` : ''}.</p>
                </div>
            ) : (
                <div className="admin-sections">
                    {filteredSections.map((section) => (
                        <div key={section.name} className="admin-section">
                            <div className="admin-section__header">
                                <h2>{section.title}</h2>
                                <div className="admin-section__actions">
                                    <span className="admin-section__count">
                                        {section.articles.length} bài
                                    </span>
                                    {reorderSection === section.name ? (
                                        <>
                                            <button
                                                className="admin-btn admin-btn--show"
                                                onClick={saveReorder}
                                                disabled={actionLoading === 'reorder'}
                                            >
                                                {actionLoading === 'reorder' ? '⏳' : '💾'} Lưu thứ tự
                                            </button>
                                            <button
                                                className="admin-btn admin-btn--cancel"
                                                onClick={() => { setReorderSection(null); setReorderList([]) }}
                                            >
                                                Hủy
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            className="admin-btn admin-btn--reorder"
                                            onClick={() => startReorder(section)}
                                            title="Sắp xếp lại thứ tự"
                                        >
                                            ↕ Sắp xếp
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Reorder mode */}
                            {reorderSection === section.name ? (
                                <div className="admin-reorder-list">
                                    {reorderList.map((item, idx) => (
                                        <div key={item.slug} className="admin-reorder-item">
                                            <span className="admin-reorder-item__grip">☰</span>
                                            <span className="admin-reorder-item__title">{item.title}</span>
                                            <span className="admin-reorder-item__slug">{item.slug}</span>
                                            <div className="admin-reorder-item__arrows">
                                                <button
                                                    onClick={() => moveItem(idx, -1)}
                                                    disabled={idx === 0}
                                                    title="Lên"
                                                >▲</button>
                                                <button
                                                    onClick={() => moveItem(idx, 1)}
                                                    disabled={idx === reorderList.length - 1}
                                                    title="Xuống"
                                                >▼</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Normal article list */
                                <div className="admin-section__list">
                                    {section.articles.map((article) => (
                                        <div
                                            key={article.path}
                                            className={`admin-article ${article.hidden ? 'admin-article--hidden' : ''}`}
                                        >
                                            <div className="admin-article__info">
                                                <div className="admin-article__title">
                                                    <span className={`admin-article__status ${article.hidden ? 'admin-article__status--hidden' : 'admin-article__status--visible'}`} />
                                                    <span>{article.title}</span>
                                                    {article.hidden && (
                                                        <span className="admin-article__badge">Ẩn</span>
                                                    )}
                                                </div>
                                                <div className="admin-article__meta">
                                                    <code>{article.path}</code>
                                                    <span className="admin-article__file">{article.file}</span>
                                                </div>
                                            </div>
                                            <div className="admin-article__actions">
                                                {/* Edit button */}
                                                <button
                                                    className="admin-btn admin-btn--edit"
                                                    onClick={() => setEditingArticle(article)}
                                                    title="Chỉnh sửa bài viết"
                                                >
                                                    ✏️ Sửa
                                                </button>
                                                {/* Toggle visibility */}
                                                <button
                                                    className={`admin-btn ${article.hidden ? 'admin-btn--show' : 'admin-btn--hide'}`}
                                                    onClick={() => handleToggleVisibility(article.path, article.hidden)}
                                                    disabled={actionLoading === article.path}
                                                    title={article.hidden ? 'Hiện bài viết' : 'Ẩn bài viết'}
                                                >
                                                    {actionLoading === article.path ? (
                                                        <span className="admin-btn__spinner" />
                                                    ) : article.hidden ? (
                                                        <>👁️ Hiện</>
                                                    ) : (
                                                        <>🙈 Ẩn</>
                                                    )}
                                                </button>
                                                {/* Delete */}
                                                {confirmDelete === article.path ? (
                                                    <div className="admin-confirm">
                                                        <span>Chắc chắn?</span>
                                                        <button
                                                            className="admin-btn admin-btn--danger"
                                                            onClick={() => handleDelete(article.path)}
                                                            disabled={actionLoading === article.path}
                                                        >
                                                            Xóa
                                                        </button>
                                                        <button
                                                            className="admin-btn admin-btn--cancel"
                                                            onClick={() => setConfirmDelete(null)}
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="admin-btn admin-btn--delete"
                                                        onClick={() => setConfirmDelete(article.path)}
                                                        disabled={actionLoading === article.path}
                                                        title="Xóa bài viết"
                                                    >
                                                        🗑️ Xóa
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Editor Modal */}
            {editingArticle && (
                <ArticleEditor
                    article={editingArticle}
                    onClose={() => setEditingArticle(null)}
                    onSaved={() => fetchArticles()}
                    showToast={showToast}
                />
            )}

            {/* Create Article Modal */}
            {showCreate && (
                <CreateArticle
                    sections={sections}
                    onClose={() => setShowCreate(false)}
                    onCreated={() => fetchArticles()}
                    showToast={showToast}
                />
            )}

            {/* User Manager Modal (Level 1 only) */}
            {showUserManager && (
                <UserManager onClose={() => setShowUserManager(false)} />
            )}

            {/* Toast notification */}
            {toast && (
                <div className={`admin-toast admin-toast--${toast.type}`}>
                    <span>{toast.type === 'success' ? '✅' : '❌'}</span>
                    <span>{toast.message}</span>
                </div>
            )}
        </div>
    )
}
