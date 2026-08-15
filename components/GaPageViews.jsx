'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Bắn page_view mỗi khi đổi trang.
 *
 * Nextra điều hướng bằng History API nên trình duyệt không tải lại trang,
 * gtag('config', ...) chỉ chạy đúng một lần ở trang đầu tiên. Không có
 * component này thì GA4 chỉ đếm được trang người dùng vào đầu tiên.
 *
 * Đi kèm với send_page_view: false trong app/layout.jsx — gtag không tự bắn
 * page_view nữa, toàn bộ do chỗ này lo, kể cả lượt xem đầu tiên. Nhờ vậy mỗi
 * lượt xem chỉ được đếm đúng một lần.
 */
export default function GaPageViews() {
    const pathname = usePathname()

    useEffect(() => {
        if (typeof window.gtag !== 'function') return

        window.gtag('event', 'page_view', {
            page_path: pathname,
            page_location: window.location.href,
            page_title: document.title,
        })
    }, [pathname])

    return null
}
