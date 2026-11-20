// 서버 전용: 현재 로그인한 사용자와 역할 읽기, 공무원 역할 부여 (PLAN 작업 13번)
import "server-only";
import type { User } from "@supabase/supabase-js";
import { connection } from "next/server";
import { createAdminClient } from "../supabase/admin.ts";
import { createClient } from "../supabase/server.ts";
import { allowedDomains, shouldBecomeOfficial, type Role } from "./roles.ts";

/** 쿠키의 로그인 정보를 Supabase에 확인해서 사용자와 역할을 돌려준다. 로그인 전이면 null. */
export async function getCurrentUser(): Promise<{ user: User; role: Role | null } | null> {
  // 로그인 확인은 현재 시각(Date.now)을 쓰므로 "요청 때 그린다"고 먼저 알린다. (안 하면 개발 화면에 Date.now 오류가 뜬다)
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser(); // 쿠키 값을 믿지 않고 서버에 확인한다
  if (error || !data.user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", data.user.id).maybeSingle();
  return { user: data.user, role: (profile?.role as Role | undefined) ?? null };
}

/**
 * 허용 도메인 이메일로 인증을 마친 "승인 대기" 계정을 공무원으로 올린다. (역할 변경은 서버 열쇠로만 한다)
 * 올렸으면 새 역할을, 아니면 지금 역할을 돌려준다.
 */
export async function ensureOfficialRole(user: User): Promise<Role | null> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role, org_id, org_name_requested")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) return null;

  const promote = shouldBecomeOfficial({
    role: profile.role as Role,
    orgId: profile.org_id,
    orgNameRequested: profile.org_name_requested,
    email: user.email ?? "",
    emailConfirmed: !!user.email_confirmed_at,
    domains: allowedDomains(process.env.ALLOWED_EMAIL_DOMAINS),
  });
  if (!promote) return profile.role as Role;

  const { error } = await admin.from("profiles").update({ role: "official" }).eq("user_id", user.id);
  if (error) {
    console.error("공무원 역할 부여 실패:", error.message);
    return profile.role as Role;
  }
  return "official";
}
