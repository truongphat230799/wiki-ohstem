import { NextResponse } from 'next/server'

export function middleware(request) {
    const { pathname } = request.nextUrl

    // Only protect /admin and /api/admin routes
    const isAdminPage = pathname.startsWith('/admin')
    const isAdminApi = pathname.startsWith('/api/admin')

    if (!isAdminPage && !isAdminApi) {
        return NextResponse.next()
    }

    // Allow login page and login API without auth
    if (
        pathname === '/admin/login' ||
        pathname === '/api/admin/auth/login'
    ) {
        return NextResponse.next()
    }

    // Check for JWT token in cookie
    const token = request.cookies.get('admin_token')?.value

    if (!token) {
        // API requests get 401, page requests get redirected
        if (isAdminApi) {
            return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
        }
        return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Token exists — let the request through
    // (actual token verification happens in the API handlers)
    return NextResponse.next()
}

export const config = {
    matcher: ['/admin/:path*', '/api/admin/:path*'],
}
