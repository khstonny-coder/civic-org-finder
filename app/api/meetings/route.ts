// 간담회 목록·만들기 (PLAN 작업 16번, DESIGN 3.3). 본인 것만 읽고 쓴다. (DB 접근 규칙이 소유자·역할을 다시 확인한다)
import { requireOfficial } from "../../../lib/auth/require.ts";
import { parseMeeting } from "../../../lib/meetings/validate.ts";
import { createClient } from "../../../lib/supabase/server.ts";

export async function GET(): Promise<Response> {
  const auth = await requireOfficial();
  if ("error" in auth) return auth.error;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetings")
    .select("id, title, region_code, held_on, purge_after, meeting_orgs(count)")
    .order("held_on", { ascending: false });
  if (error) {
    console.error("간담회 목록 오류:", error.message);
    return Response.json({ ok: false, message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
  return Response.json({ ok: true, meetings: data });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await requireOfficial();
  if ("error" in auth) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const parsed = parseMeeting(body);
  if (!parsed.ok) return Response.json({ ok: false, message: parsed.message }, { status: 400 });
  const { title, heldOn, regionCode, orgIds } = parsed.meeting;

  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({ owner_id: auth.user.id, title, held_on: heldOn, region_code: regionCode })
    .select("id")
    .single();
  if (error || !meeting) {
    console.error("간담회 만들기 오류:", error?.message);
    return Response.json({ ok: false, message: "간담회를 만들지 못했습니다. 지역 정보를 확인해 주세요." }, { status: 400 });
  }

  if (orgIds.length > 0) {
    // 초청 단체는 내가 볼 수 있는(공개된) 단체만 받는다.
    const { data: visible } = await supabase.from("organizations").select("id").in("id", orgIds);
    const rows = (visible ?? []).map((o) => ({ meeting_id: meeting.id, org_id: o.id as string }));
    if (rows.length > 0) {
      const { error: inviteError } = await supabase.from("meeting_orgs").insert(rows);
      if (inviteError) console.error("초청 단체 저장 오류:", inviteError.message);
    }
  }
  return Response.json({ ok: true, id: meeting.id });
}
