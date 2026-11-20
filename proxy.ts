// 로그인 여부 확인 (PLAN 작업 13번; Next.js 16에서는 middleware 대신 proxy라는 이름을 쓴다)
// - 로그인 정보(쿠키)를 새로 고치고, 로그인하지 않은 사람이 화면을 열면 /login으로 보낸다.
// - 여기는 "1차 확인"일 뿐이다. 역할에 따른 접근 제한은 각 API(route.ts)와 DB 접근 규칙이 다시 확인한다.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // API: 다른 사이트의 페이지가 로그인한 사용자의 브라우저로 우리 API에 글을 보내는 것(CSRF)을 막는다.
  // 브라우저는 다른 사이트에서 보낸 POST·PATCH·DELETE에 항상 Origin을 붙이므로, 우리 주소와 다르면 거절한다.
  // (Origin이 없는 호출 — 서버끼리의 호출 등 — 은 브라우저가 아니므로 통과시킨다. 각 API가 로그인·역할을 따로 확인한다.)
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin");
    const mutating = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (mutating && origin) {
      let sameSite = false;
      try {
        sameSite = new URL(origin).host === request.nextUrl.host;
      } catch {
        sameSite = false;
      }
      if (!sameSite) {
        return NextResponse.json({ ok: false, message: "허용되지 않은 요청입니다." }, { status: 403 });
      }
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === "/login";

  if (!data.user && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (data.user && isLoginPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  // 화면은 로그인 여부를 확인하고, API(/api/…)는 위의 Origin 검사만 한다. (로그인·역할은 각 API가 확인) 정적 파일은 건너뛴다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
