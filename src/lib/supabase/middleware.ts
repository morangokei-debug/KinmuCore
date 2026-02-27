import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function applyCookiesToResponse(
  target: NextResponse,
  source: NextResponse
): void {
  source.cookies.getAll().forEach(({ name, value, ...options }) =>
    target.cookies.set(name, value, options)
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 打刻ページ（/punch/*）は認証不要
  if (request.nextUrl.pathname.startsWith('/punch')) {
    return supabaseResponse;
  }

  // 未認証ユーザーをログインページへリダイレクト
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    applyCookiesToResponse(redirect, supabaseResponse);
    return redirect;
  }

  // 認証済みユーザーがログインページにアクセスした場合はダッシュボードへ
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/attendance';
    const redirect = NextResponse.redirect(url);
    applyCookiesToResponse(redirect, supabaseResponse);
    return redirect;
  }

  return supabaseResponse;
}
