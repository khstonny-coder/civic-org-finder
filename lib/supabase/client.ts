// 브라우저(화면)에서 DB·로그인에 연결하는 도구.
// 공개용 주소와 공개용 키만 사용한다. (DESIGN 8.2: 데이터는 행 단위 보안이 막아 준다)
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // NEXT_PUBLIC_ 변수는 Next.js가 빌드할 때 값을 끼워 넣으므로, 아래처럼 이름을 그대로 적어야 한다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      ".env에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY 값이 필요합니다.",
    );
  }

  return createBrowserClient(url, anonKey);
}
