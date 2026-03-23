'use client'

import { useState, useRef } from 'react'

export default function CreateArticle({ sections, onClose, onCreated, showToast }) {
    const [section, setSection] = useState('')
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [content, setContent] = useState('')
    const [autoSlug, setAutoSlug] = useState(true)
    const [creating, setCreating] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef(null)
    const textareaRef = useRef(null)

    // Build section options (including subsections)
    const sectionOptions = []
    sections.forEach((s) => {
        sectionOptions.push({ value: s.name, label: s.title })
        // Check for subfolder articles
        const subSections = [...new Set(s.articles.filter(a => a.subSection).map(a => a.subSection))]
        subSections.forEach((sub) => {
            sectionOptions.push({ value: `${s.name}/${sub}`, label: `${s.title} → ${sub}` })
        })
    })

    // Auto-generate slug from title
    const handleTitleChange = (value) => {
        setTitle(value)
        if (autoSlug) {
            const generated = value
                .toLowerCase()
                .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
                .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
                .replace(/[ìíịỉĩ]/g, 'i')
                .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
                .replace(/[ùúụủũưừứựửữ]/g, 'u')
                .replace(/[ỳýỵỷỹ]/g, 'y')
                .replace(/đ/g, 'd')
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
            setSlug(generated)
        }
    }

    const handleSlugChange = (value) => {
        setAutoSlug(false)
        setSlug(value)
    }

    const handleImageUpload = async (e) => {
        const file = e.target.files?.[0]
        if (!file || !section) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('directory', section)

            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                body: formData,
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            // Insert at cursor in content textarea
            const textarea = textareaRef.current
            if (textarea) {
                const start = textarea.selectionStart
                const before = content.substring(0, start)
                const after = content.substring(textarea.selectionEnd)
                const imgMd = `\n${data.markdown}\n`
                setContent(before + imgMd + after)
            } else {
                setContent(content + `\n${data.markdown}\n`)
            }
            showToast(data.message)
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const handleCreate = async () => {
        if (!section || !title || !slug) {
            showToast('Vui lòng điền đầy đủ section, tiêu đề và slug.', 'error')
            return
        }

        setCreating(true)
        try {
            const mdxContent = `---\ntitle: "${title}"\n---\n\n# ${title}\n\n${content || 'Nội dung bài viết...'}\n`

            const res = await fetch('/api/admin/list-articles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', section, slug, title, content: mdxContent }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            showToast(data.message)
            if (onCreated) onCreated()
            onClose()
        } catch (err) {
            showToast(err.message, 'error')
        } finally {
            setCreating(false)
        }
    }

    return (
        <div className="editor-overlay">
            <div className="create-modal">
                <div className="editor-header">
                    <div className="editor-header__info">
                        <h2>➕ Tạo bài viết mới</h2>
                    </div>
                    <div className="editor-header__actions">
                        <button
                            className="admin-btn admin-btn--show"
                            onClick={handleCreate}
                            disabled={creating || !section || !title || !slug}
                        >
                            {creating ? '⏳ Đang tạo...' : '✅ Tạo bài viết'}
                        </button>
                        <button className="admin-btn admin-btn--cancel" onClick={onClose}>
                            ✕ Đóng
                        </button>
                    </div>
                </div>

                <div className="create-form">
                    <div className="create-field">
                        <label>📁 Chuyên mục (Section)</label>
                        <select value={section} onChange={(e) => setSection(e.target.value)}>
                            <option value="">— Chọn chuyên mục —</option>
                            {sectionOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="create-field-row">
                        <div className="create-field" style={{ flex: 2 }}>
                            <label>📝 Tiêu đề</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => handleTitleChange(e.target.value)}
                                placeholder="Ví dụ: Hướng dẫn lập trình LED"
                            />
                        </div>
                        <div className="create-field" style={{ flex: 1 }}>
                            <label>🔗 Slug (URL)</label>
                            <input
                                type="text"
                                value={slug}
                                onChange={(e) => handleSlugChange(e.target.value)}
                                placeholder="huong-dan-lap-trinh-led"
                            />
                        </div>
                    </div>

                    <div className="create-field">
                        <label>
                            📄 Nội dung (Markdown)
                            <button
                                className="create-upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading || !section}
                            >
                                {uploading ? '⏳' : '📤'} Upload ảnh
                            </button>
                        </label>
                        <textarea
                            ref={textareaRef}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Nhập nội dung bài viết bằng markdown... (có thể bỏ trống, sẽ tạo template mặc định)"
                            rows={12}
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            style={{ display: 'none' }}
                        />
                    </div>

                    {title && slug && section && (
                        <div className="create-preview-path">
                            📍 Đường dẫn: <code>/{section}/{slug}</code> → File: <code>content/{section}/{slug}.mdx</code>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
