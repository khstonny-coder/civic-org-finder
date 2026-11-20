// 단체 담당자 가입 (PLAN 작업 18번, DESIGN 4.5): 이메일(도메인 제한 없음)·비밀번호·단체명을 받는다.
// 가입하면 역할은 항상 '단체 승인 대기'다. 관리자가 본인 확인 후 단체를 연결해 승인해야 '단체'가 된다. (PLAN 19번)
// 단체명은 가입 정보(user_metadata)로 넘기고, DB 트리거가 profiles.org_name_requested에 저장한다.
import { isValidEmail } from "../../../../lib/auth/roles.ts";
import { parseOrgName } from "../../../../lib/orgs/submission.ts";
import { createClient } from "../../../../lib/supabase/server.ts";

export async function POST(request: Request): Promise<Response> {
  let body: { email?: string; password?: string; orgName?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const orgName = parseOrgName(body.orgName);

  if (!isValidEmail(email)) return Response.json({ ok: false, message: "이메일 형식이 올바르지 않습니다." }, { status: 400 });
  if (!orgName) return Response.json({ ok: false, message: "신청할 단체명을 2자 이상 100자 이하로 적어 주세요." }, { status: 400 });
  if (password.length < 8 || password.length > 72) {
    return Response.json({ ok: false, message: "비밀번호는 8자 이상 72자 이하로 정해 주세요." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { org_name: orgName }, emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/login` },
  });
  if (error) {
    console.error("단체 담당자 가입 실패:", error.message);
    return Response.json({ ok: false, message: "가입하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 400 });
  }
  return Response.json({
    ok: true,
    message: "인증 메일을 보냈습니다. 메일 인증 후 로그인하면 관리자 확인을 기다리는 상태가 되며, 확인이 끝나면 단체 정보를 등록할 수 있습니다.",
  });
}
