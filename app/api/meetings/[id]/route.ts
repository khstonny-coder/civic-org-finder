// 간담회 한 건: 참석 상태 바꾸기, 단체 추가·빼기, 간담회 삭제 (PLAN 작업 16번). 본인 것만 다룬다.
import { requireOfficial } from "../../../../lib/auth/require.ts";
import { parseChange } from "../../../../lib/meetings/validate.ts";
import { createClient } from "../../../../lib/supabase/server.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_INVITED = 50;

export async function PATCH(request: Request, ctx: RouteContext<"/api/meetings/[id]">): Promise<Response> {
  const auth = await requireOfficial();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, message: "간담회를 찾을 수 없습니다." }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseChange(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  const change = parsed.change;

  const supabase = await createClient();
  // 내 간담회인지 먼저 확인한다. (남의 것이면 DB 규칙 때문에 보이지 않는다)
  const { data: meeting } = await supabase.from("meetings").select("id").eq("id", id).maybeSingle();
  if (!meeting) return Response.json({ ok: false, message: "간담회를 찾을 수 없습니다." }, { status: 404 });

  if (change.kind === "attendance") {
    const { data, error } = await supabase
      .from("meeting_orgs")
      .update({ attendance: change.attendance })
      .eq("meeting_id", id)
      .eq("org_id", change.orgId)
      .select("org_id");
    if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
    if (!data || data.length === 0) return Response.json({ ok: false, message: "초청 목록에 없는 단체입니다." }, { status: 404 });
  } else if (change.kind === "remove") {
    const { error } = await supabase.from("meeting_orgs").delete().eq("meeting_id", id).eq("org_id", change.orgId);
    if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
  } else {
    const { count } = await supabase.from("meeting_orgs").select("org_id", { count: "exact", head: true }).eq("meeting_id", id);
    if ((count ?? 0) + change.orgIds.length > MAX_INVITED) {
      return Response.json({ ok: false, message: `한 간담회에는 단체를 ${MAX_INVITED}곳까지 초청할 수 있습니다.` }, { status: 400 });
    }
    const { data: visible } = await supabase.from("organizations").select("id").in("id", change.orgIds);
    const rows = (visible ?? []).map((o) => ({ meeting_id: id, org_id: o.id as string }));
    if (rows.length > 0) {
      // 이미 초청된 단체는 그대로 둔다.
      const { error } = await supabase.from("meeting_orgs").upsert(rows, { onConflict: "meeting_id,org_id", ignoreDuplicates: true });
      if (error) return Response.json({ ok: false, message: "저장하지 못했습니다." }, { status: 500 });
    }
  }
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/meetings/[id]">): Promise<Response> {
  const auth = await requireOfficial();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return Response.json({ ok: false, message: "간담회를 찾을 수 없습니다." }, { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").delete().eq("id", id).select("id");
  if (error) return Response.json({ ok: false, message: "삭제하지 못했습니다." }, { status: 500 });
  if (!data || data.length === 0) return Response.json({ ok: false, message: "간담회를 찾을 수 없습니다." }, { status: 404 });
  return Response.json({ ok: true });
}
