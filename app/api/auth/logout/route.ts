// 로그아웃 (PLAN 작업 13번): 로그인 쿠키를 지운다.
import { createClient } from "../../../../lib/supabase/server.ts";

export async function POST(): Promise<Response> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return Response.json({ ok: true });
}
