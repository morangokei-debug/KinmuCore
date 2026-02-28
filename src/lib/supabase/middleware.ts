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

  // ログインページは Supabase 呼び出しをスキップ（504 タイムアウト回避）
  if (request.nextUrl.pathname.startsWith('/login')) {
    return supabaseResponse;
  }

  // 打刻ページ（/punch/*）は認証不要
  if (request.nextUrl.pathname.startsWith('/punch')) {
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

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch {
    return supabaseResponse;
  }

  // 未認証ユーザーをログインページへリダイレクト
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    const redirect = NextResponse.redirect(url);
    applyCookiesToResponse(redirect, supabaseResponse);
    return redirect;
  }

  return supabaseResponse;
}
