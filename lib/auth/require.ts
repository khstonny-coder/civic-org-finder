// 서버 전용: API 입구에서 역할을 확인한다. (DESIGN 8.1 역할별 접근 표)
import "server-only";
import type { User } from "@supabase/supabase-js";
import { getCurrentUser } from "./server.ts";

type Result = { user: User } | { error: Response };

async function requireRole(role: "official" | "admin", message: string): Promise<Result> {
  const current = await getCurrentUser();
  if (!current) return { error: Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 }) };
  if (current.role !== role) return { error: Response.json({ ok: false, message }, { status: 403 }) };
  return { user: current.user };
}

/** 간담회는 공무원 본인만 쓴다 */
export const requireOfficial = () => requireRole("official", "공무원 계정만 이용할 수 있습니다.");

/** 관리 기능은 관리자만 쓴다 */
export const requireAdmin = () => requireRole("admin", "관리자만 이용할 수 있습니다.");
