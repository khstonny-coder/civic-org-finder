// 공무원 가입 (PLAN 작업 13번, DESIGN 4.5): 허용 도메인(go.kr, korea.kr, 추가분) 이메일만 받는다.
// 가입하면 Supabase가 인증 메일을 보내고, 인증 후 첫 로그인 때 공무원 역할이 부여된다.
// 이 검사를 건너뛰고 Supabase에 직접 가입하더라도 역할은 허용 도메인 + 인증 완료일 때만 올라간다. (lib/auth/roles.ts)
import { allowedDomains, isAllowedOfficialEmail, isValidEmail } from "../../../../lib/auth/roles.ts";
import { createClient } from "../../../../lib/supabase/server.ts";

export async function POST(request: Request): Promise<Response> {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!isValidEmail(email)) {
    return Response.json({ ok: false, message: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (!isAllowedOfficialEmail(email, allowedDomains(process.env.ALLOWED_EMAIL_DOMAINS))) {
    return Response.json({ ok: false, message: "공공기관 이메일만 가입할 수 있습니다." }, { status: 403 });
  }
  if (password.length < 8 || password.length > 72) {
    return Response.json({ ok: false, message: "비밀번호는 8자 이상 72자 이하로 정해 주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    // 인증 메일의 돌아올 주소는 .env의 NEXT_PUBLIC_SITE_URL(배포 주소)을 우선한다. 요청 주소는 조작될 수 있어 개발 때만 쓴다.
    options: { emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/login` },
  });
  if (error) {
    console.error("가입 실패:", error.message);
    return Response.json({ ok: false, message: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 400 });
  }
  // 이미 가입한 메일이어도 같은 문구로 답한다. (가입 여부 노출 방지)
  return Response.json({ ok: true, message: "인증 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요." });
}
