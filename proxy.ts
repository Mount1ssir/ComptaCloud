import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const { pathname } = url

  // Define route check helpers
  const isSuperAdminRoute = pathname.startsWith('/super-admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isHomeRoute = pathname === '/'

  // Initialize response
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Create Supabase client and refresh session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Helper to perform redirects while preserving refreshed cookies
  const redirectWithCookies = (targetUrl: URL) => {
    const redirectRes = NextResponse.redirect(targetUrl)
    // Copy cookies from our active 'response' object to the redirect response
    response.cookies.getAll().forEach(cookie => {
      redirectRes.cookies.set(cookie.name, cookie.value, {
        path: cookie.path,
        domain: cookie.domain,
        maxAge: cookie.maxAge,
        expires: cookie.expires,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
      })
    })
    return redirectRes
  }

  // Get current user session (refreshes if expired)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 1. Unauthenticated users
  if (!user) {
    if (isSuperAdminRoute || isDashboardRoute) {
      url.pathname = '/'
      return redirectWithCookies(url)
    }
    return response
  }

  const isAcceptInviteRoute = pathname.startsWith('/accept-invite')

  if (isAcceptInviteRoute) {
    return response
  }

  // 2. Authenticated users: Check if user has a platform management role via is_platform_role() RPC
  // OLD CHECK: const { data: profile, error } = await supabase.from('users').select('role').eq('id', user.id).maybeSingle()
  const { data: isPlatformRole, error } = await supabase.rpc('is_platform_role')

  // Fallback: If profile/role check fails
  if (error || isPlatformRole === null || isPlatformRole === undefined) {
    console.error('Role check error for authenticated user:', error || 'RPC returned null/undefined')
    if (isSuperAdminRoute || isDashboardRoute) {
      // Clear cookies by setting expired cookies on redirect response
      const redirectResponse = NextResponse.redirect(new URL('/', request.url))
      request.cookies.getAll().forEach(cookie => {
        if (cookie.name.startsWith('sb-')) {
          redirectResponse.cookies.set(cookie.name, '', { maxAge: 0 })
        }
      })
      return redirectResponse
    }
    return response
  }

  // 3. Route protection and redirection rules
  // OLD CHECK: if (role === 'super_admin')
  if (isPlatformRole) {
    // Platform management roles (e.g. super_admin) go to /super-admin
    if (isDashboardRoute || isHomeRoute) {
      url.pathname = '/super-admin'
      return redirectWithCookies(url)
    }
  } else {
    // Tenant roles (cabinet_admin, accountant, client) go to /dashboard
    if (isSuperAdminRoute || isHomeRoute) {
      url.pathname = '/dashboard'
      return redirectWithCookies(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - any files with extensions (e.g. .png, .jpg, .svg)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)',
  ],
}
