// 서버 전용: 접근 규칙을 건너뛰고 DB 전체에 접근하는 "관리자 열쇠" 연결.
// 수집 저장, 승인 처리, 역할 변경처럼 서버가 대신 해야 하는 일에만 쓴다.
// SUPABASE_SERVICE_ROLE_KEY는 절대 브라우저로 나가면 안 된다. (아래 import가 실수로 화면 코드에서 쓰이면 빌드를 막아 준다)
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      ".env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 값이 필요합니다.",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
