// 서버(화면의 서버 부분, route.ts)에서 "로그인한 사용자의 권한으로" DB에 연결하는 도구.
// 로그인 정보는 쿠키에서 읽고, 접근 규칙(행 단위 보안)이 그대로 적용된다.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      ".env에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 값이 필요합니다.",
    );
  }

  // Next.js 16에서 cookies()는 비동기 함수라 await가 필요하다.
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 화면(서버 컴포넌트)에서는 쿠키를 쓸 수 없어 오류가 난다. 무시해도 된다.
          // 로그인 갱신은 proxy.ts나 route.ts에서 처리한다.
        }
      },
    },
  });
}
