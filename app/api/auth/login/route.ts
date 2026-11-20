// 로그인 (PLAN 작업 13번): 이메일·비밀번호 확인 → 쿠키에 로그인 정보 저장 → 인증을 마친 공무원 메일이면 역할 부여
import { ensureOfficialRole } from "../../../../lib/auth/server.ts";
import { createClient } from "../../../../lib/supabase/server.ts";

export async function POST(request: Request): Promise<Response> {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return Response.json({ ok: false, message: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    // 이메일이 없는지 비밀번호가 틀렸는지 알려 주지 않는다. (가입 여부 노출 방지)
    return Response.json(
      { ok: false, message: "이메일 또는 비밀번호가 올바르지 않거나, 이메일 인증이 끝나지 않았습니다." },
      { status: 401 },
    );
  }

  const role = await ensureOfficialRole(data.user);
  return Response.json({ ok: true, role });
}
