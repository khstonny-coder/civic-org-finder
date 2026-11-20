// 단체 찾기 (PLAN 작업 19번): 담당자 본인 확인 때 연결할 단체를 이름으로 찾는다. 관리자 전용, 최대 10건.
import { requireAdmin } from "../../../../lib/auth/require.ts";
import { createAdminClient } from "../../../../lib/supabase/admin.ts";

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 50);
  if (q.length < 2) return Response.json({ ok: true, orgs: [] });
  // LIKE 검색에서 특별한 뜻이 있는 글자는 일반 글자로 취급한다.
  const safe = q.replace(/[\\%_,()]/g, " ").trim();
  if (safe.length < 2) return Response.json({ ok: true, orgs: [] });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("id, name, region_code, status")
    .ilike("name", `%${safe}%`)
    .order("name")
    .limit(10);
  if (error) return Response.json({ ok: false, message: "검색하지 못했습니다." }, { status: 500 });
  return Response.json({ ok: true, orgs: data });
}
