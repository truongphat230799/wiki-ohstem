'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

export default function ArticleEditor({ article, onClose, onSaved, showToast }) {
    const [content, setContent] = useState('')
    const [originalContent, setOriginalContent] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [previewMode, setPreviewMode] = useState('split') // 'edit' | 'split' | 'preview'
    const textareaRef = useRef(null)
    const fileInputRef = useRef(null)
    const modelInputRef = useRef(null)

    // Load article content
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch('/api/admin/list-articles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read', articlePath: article.path }),
                })
                const data = await res.json()
                if (!res.ok) throw new Error(data.error)
                setContent(data.content)
                setOriginalContent(data.content)
            } catch (err) {
                showToast(err.message, 'error')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [article.path, showToast])

    const handleSave = async () => {
        setSaving(true)
        setSaved(false)
        try {
            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'save', articlePath: article.path, content }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Also call refresh-page API to revalidate the wiki page
            try {
                await fetch('/api/admin/refresh-page', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path: article.path }),
                })
            } catch { /* non-critical */ }

            showToast(data.message)
            setOriginalContent(content)
            setSaved(true)
            if (onSaved) onSaved()
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            // Determine upload directory from article section
            const sectionParts = article.path.replace(/^\//, '').split('/')
            const directory = sectionParts.slice(0, -1).join('/')

            const formData = new FormData()
            formData.append('file', file)
            formData.append('directory', directory)

            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Insert markdown image at cursor position
            const textarea = textareaRef.current
            if (textarea) {
                const start = textarea.selectionStart
                const before = content.substring(0, start)
                const after = content.substring(textarea.selectionEnd)
                const imageMarkdown = `\n${data.markdown}\n`
                const newContent = before + imageMarkdown + after
                setContent(newContent)
                // Move cursor after inserted text
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + imageMarkdown.length
                    textarea.focus()
                }, 0)
            }

            showToast(data.message)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleModelUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)

            const res = await fetch('/api/admin/upload-model', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Insert Model3D tag at cursor
            const textarea = textareaRef.current
            if (textarea) {
                const start = textarea.selectionStart
                const before = content.substring(0, start)
                const after = content.substring(textarea.selectionEnd)
                const modelName = file.name.replace(/\.[^.]+$/, '')
                const tag = `\n<Model3D src="${data.model.src}" caption="${modelName}" />\n`
                setContent(before + tag + after)
                setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = start + tag.length
                    textarea.focus()
                }, 0)
            }

            showToast(data.message)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setUploading(false)
            if (modelInputRef.current) modelInputRef.current.value = ''
        }
    }

    // Insert markdown syntax at cursor
    const insertMarkdown = useCallback((prefix, suffix = '') => {
        const textarea = textareaRef.current
        if (!textarea) return

        const start = textarea.selectionStart
        const end = textarea.selectionEnd
        const selected = content.substring(start, end)
        const before = content.substring(0, start)
        const after = content.substring(end)

        const newText = prefix + (selected || 'text') + suffix
        setContent(before + newText + after)

        setTimeout(() => {
            if (selected) {
                textarea.selectionStart = start
                textarea.selectionEnd = start + newText.length
            } else {
                textarea.selectionStart = start + prefix.length
                textarea.selectionEnd = start + prefix.length + 4
            }
            textarea.focus()
        }, 0)
    }, [content])

    const hasChanges = content !== originalContent

    // Simple markdown to HTML converter for preview
    const renderPreview = (md) => {
        let html = md
            // Frontmatter removal
            .replace(/^---[\s\S]*?---\n*/m, '')
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Bold and italic
            .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0" />')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#6366f1">$1</a>')
            // Code blocks
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:#1e293b;color:#e2e8f0;padding:12px;border-radius:8px;overflow-x:auto"><code>$2</code></pre>')
            // Inline code
            .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
            // Unordered lists
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            // Line breaks
            .replace(/\n\n/g, '<br/><br/>')
            .replace(/\n/g, '<br/>')

        // Wrap consecutive <li> in <ul>
        html = html.replace(/(<li>.*?<\/li>(<br\/>)?)+/g, (match) => {
            return '<ul style="margin:8px 0;padding-left:20px">' + match.replace(/<br\/>/g, '') + '</ul>'
        })

        return html
    }

    // Keyboard shortcut
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault()
            if (hasChanges && !saving) handleSave()
        }
    }

    return (
        <div className="editor-overlay" onKeyDown={handleKeyDown}>
            <div className="editor-modal">
                {/* Editor Header */}
                <div className="editor-header">
                    <div className="editor-header__info">
                        <h2>✏️ {article.title}</h2>
                        <span className="editor-header__path">{article.path}</span>
                    </div>
                    <div className="editor-header__actions">
                        {/* View mode toggles */}
                        <div className="editor-view-toggle">
                            <button
                                className={`editor-view-btn ${previewMode === 'edit' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('edit')}
                                title="Chỉ editor"
                            >📝</button>
                            <button
                                className={`editor-view-btn ${previewMode === 'split' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('split')}
                                title="Split view"
                            >📰</button>
                            <button
                                className={`editor-view-btn ${previewMode === 'preview' ? 'active' : ''}`}
                                onClick={() => setPreviewMode('preview')}
                                title="Chỉ preview"
                            >👁️</button>
                        </div>
                        <button
                            className="admin-btn admin-btn--show"
                            onClick={handleSave}
                            disabled={saving || !hasChanges}
                        >
                            {saving ? '⏳ Đang lưu...' : '💾 Lưu (Ctrl+S)'}
                        </button>
                        {saved && (
                            <>
                                <button
                                    className="admin-btn admin-btn--edit"
                                    onClick={() => {
                                        window.open(`/admin/preview?path=${encodeURIComponent(article.path)}`, '_blank')
                                    }}
                                    title="Xem nội dung mới nhất (đọc trực tiếp từ file)"
                                >
                                    👁️ Preview
                                </button>
                                <button
                                    className="admin-btn admin-btn--reorder"
                                    onClick={() => {
                                        window.open(article.path, '_blank')
                                    }}
                                    title="Mở trang wiki chính thức (có thể cần reload nếu cache)"
                                >
                                    🔗 Wiki Page
                                </button>
                            </>
                        )}
                        <button className="admin-btn admin-btn--cancel" onClick={onClose}>
                            ✕ Đóng
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="editor-toolbar">
                    <button onClick={() => insertMarkdown('**', '**')} title="Bold (Ctrl+B)">
                        <strong>B</strong>
                    </button>
                    <button onClick={() => insertMarkdown('*', '*')} title="Italic">
                        <em>I</em>
                    </button>
                    <button onClick={() => insertMarkdown('# ')} title="Heading 1">
                        H1
                    </button>
                    <button onClick={() => insertMarkdown('## ')} title="Heading 2">
                        H2
                    </button>
                    <button onClick={() => insertMarkdown('### ')} title="Heading 3">
                        H3
                    </button>
                    <button onClick={() => insertMarkdown('[', '](url)')} title="Link">
                        🔗
                    </button>
                    <button onClick={() => insertMarkdown('![alt](', ')')} title="Image URL">
                        🖼️
                    </button>
                    <button onClick={() => insertMarkdown('- ')} title="List item">
                        📋
                    </button>
                    <button onClick={() => insertMarkdown('```\n', '\n```')} title="Code block">
                        {'</>'}
                    </button>
                    <span className="editor-toolbar__separator" />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        title="Upload hình ảnh"
                        className="editor-toolbar__upload"
                    >
                        {uploading ? '⏳' : '📤'} Upload ảnh
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => modelInputRef.current?.click()}
                        disabled={uploading}
                        title="Upload mô hình 3D (.glb)"
                        className="editor-toolbar__upload"
                    >
                        {uploading ? '⏳' : '📦'} 3D Model
                    </button>
                    <input
                        ref={modelInputRef}
                        type="file"
                        accept=".glb,.gltf"
                        onChange={handleModelUpload}
                        style={{ display: 'none' }}
                    />
                    {hasChanges && (
                        <span className="editor-toolbar__unsaved">● Chưa lưu</span>
                    )}
                </div>

                {/* Editor Content */}
                {loading ? (
                    <div className="admin-loading" style={{ flex: 1 }}>
                        <div className="admin-spinner" />
                        <p>Đang tải nội dung...</p>
                    </div>
                ) : (
                    <div className={`editor-body editor-body--${previewMode}`}>
                        {previewMode !== 'preview' && (
                            <textarea
                                ref={textareaRef}
                                className="editor-textarea"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                spellCheck={false}
                                placeholder="Nhập nội dung markdown..."
                            />
                        )}
                        {previewMode !== 'edit' && (
                            <div
                                className="editor-preview"
                                dangerouslySetInnerHTML={{ __html: renderPreview(content) }}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
