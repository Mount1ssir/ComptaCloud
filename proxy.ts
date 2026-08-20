import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone()
  const { pathname } = url

  // Define route check helpers
  const isSuperAdminRoute = pathname.startsWith('/super-admin')
  const isDashboardRoute = pathname.startsWith('/dashboard')
  const isPortalRoute = pathname.startsWith('/portal')
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
    if (isSuperAdminRoute || isDashboardRoute || isPortalRoute) {
      url.pathname = '/'
      return redirectWithCookies(url)
    }
    return response
  }

  const isAcceptInviteRoute = pathname.startsWith('/accept-invite')

  if (isAcceptInviteRoute) {
    return response
  }

  // 2. Authenticated users: Check roles via RPC
  const { data: isPlatformRole } = await supabase.rpc('is_platform_role')
  const { data: isClientRole } = await supabase.rpc('is_client_role')

  const isSuspendedRoute = pathname.startsWith('/suspended')

  // 3. Route protection and redirection rules
  if (isPlatformRole) {
    // Platform management roles (e.g. super_admin) go to /super-admin
    if (isDashboardRoute || isHomeRoute || isPortalRoute || isSuspendedRoute) {
      url.pathname = '/super-admin'
      return redirectWithCookies(url)
    }
  } else if (isClientRole) {
    // End-client roles go to /portal ONLY
    if (isDashboardRoute || isSuperAdminRoute || isHomeRoute || isSuspendedRoute) {
      url.pathname = '/portal'
      return redirectWithCookies(url)
    }
  } else {
    // Cabinet staff roles (cabinet_admin, accountant)
    if (isPortalRoute) {
      url.pathname = '/dashboard'
      return redirectWithCookies(url)
    }

    // Check if caller's tenant is suspended
    const { data: userProfile } = await supabase
      .from('users')
      .select('tenant_id, tenants(status)')
      .eq('id', user.id)
      .maybeSingle()

    const tenantData = userProfile?.tenants as unknown
    const tenantStatus = Array.isArray(tenantData)
      ? (tenantData[0] as { status: string } | undefined)?.status || null
      : (tenantData as { status: string } | null)?.status || null

    if (tenantStatus === 'suspended') {
      if (!isSuspendedRoute) {
        url.pathname = '/suspended'
        return redirectWithCookies(url)
      }
      return response
    }

    if (isSuspendedRoute) {
      url.pathname = '/dashboard'
      return redirectWithCookies(url)
    }

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
