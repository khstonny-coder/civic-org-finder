// 챗봇 서버 입구 (PLAN 작업 9번): 입력 글에서 지역을 찾고, DB의 공개 단체를 검색해 돌려준다.
// 카드에 나오는 단체는 DB 검색 결과 그대로다. (AI가 지어낸 단체는 나올 수 없다 — DESIGN 4.1)
// 로그인한 공무원·관리자만 쓸 수 있다. (PLAN 13번)
import { canUseChat } from "../../../lib/auth/roles.ts";
import { getCurrentUser } from "../../../lib/auth/server.ts";
import { createAdminClient } from "../../../lib/supabase/admin.ts";
import { createClient } from "../../../lib/supabase/server.ts";
import { writeGuide } from "../../../lib/ai/guide.ts";
import { searchOrganizations } from "../../../lib/search/organizations.ts";
import { detectField, validField } from "../../../lib/search/fields.ts";
import { resolveRegion, type RegionRow } from "../../../lib/search/regions.ts";
import { pickSuggestions, sameSidoCodes } from "../../../lib/search/suggest.ts";
import type { ChatRequest, ChatResponse } from "../../../features/chat/types.ts";

const label = (r: RegionRow) => `${r.sido} ${r.sigungu}`;

export async function POST(request: Request): Promise<Response> {
  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ status: "error", message: "요청 형식이 올바르지 않습니다." } satisfies ChatResponse, { status: 400 });
  }
  // 객체가 아니거나 글이 문자열이 아니면 처리하지 않고 400으로 돌려보낸다. (엉뚱한 값 때문에 500 오류가 나지 않게)
  if (!body || typeof body !== "object" || (body.text !== undefined && typeof body.text !== "string")) {
    return Response.json({ status: "error", message: "요청 형식이 올바르지 않습니다." } satisfies ChatResponse, { status: 400 });
  }
  const text = (body.text ?? "").slice(0, 200); // 너무 긴 입력은 자른다
  const offset = Number.isInteger(body.offset) && (body.offset as number) > 0 ? (body.offset as number) : 0;
  // "인접 지역도 보여 줘"라고 요청했을 때만 인접 지역을 함께 찾는다. (버튼 또는 글 속의 "인접·주변")
  const includeNeighbors = body.includeNeighbors === true || /인접|주변/.test(text);

  // 로그인한 공무원·관리자만 쓸 수 있다. (DB 접근 규칙도 같은 조건으로 한 번 더 막는다)
  const current = await getCurrentUser();
  if (!current) {
    return Response.json({ status: "error", message: "로그인이 필요합니다." } satisfies ChatResponse, { status: 401 });
  }
  if (!canUseChat(current.role)) {
    return Response.json(
      { status: "error", message: "공무원 또는 관리자 계정만 이용할 수 있습니다." } satisfies ChatResponse,
      { status: 403 },
    );
  }

  try {
    // 검색은 로그인 사용자의 권한으로 한다. (공개된 단체만 보이는 규칙이 DB에서 적용된다)
    const supabase = await createClient();
    const { data, error } = await supabase.from("regions").select("*");
    if (error || !data) throw new Error("지역 표를 읽지 못했습니다.");
    const regions = data as RegionRow[];

    let region: RegionRow | undefined;
    if (body.regionCode) {
      region = regions.find((r) => r.code === body.regionCode);
    } else {
      const resolved = resolveRegion(text, regions);
      if (resolved.status === "ambiguous") {
        const candidates = resolved.candidates.slice(0, 20).map((r) => ({ code: r.code, label: label(r) }));
        const detected = body.field !== undefined ? validField(body.field) : detectField(text);
        return Response.json({ status: "ambiguous", candidates, field: detected } satisfies ChatResponse);
      }
      if (resolved.status === "found") region = resolved.region;
    }
    if (!region) {
      return Response.json({
        status: "none",
        message: "지역을 알아내지 못했습니다. 시·군·구 이름을 넣어 주세요. (예: 마포구, 수원시 팔달구)",
      } satisfies ChatResponse);
    }

    // 분야 필터: 칩으로 고른 값이 있으면 그것(빈 값은 "전체"), 없으면 글 속 분야 낱말에서 알아낸다.
    const field = body.field !== undefined ? validField(body.field) : detectField(text);

    const result = await searchOrganizations(supabase, { region, includeNeighbors, offset, field: field ?? undefined });
    const byCode = new Map(regions.map((r) => [r.code, r]));

    // AI 안내 문장: 첫 화면(offset 0)에서만 쓴다. 지역·개수·이름만 넘기고, 실패하면 정해진 문장으로 대신한다.
    const guide =
      offset === 0
        ? await writeGuide({
            regionLabel: field ? `${label(region)}의 ${field} 분야` : label(region),
            total: result.total,
            names: result.items.map((o) => o.name),
            includeNeighbors,
          })
        : null;

    // 0곳이면 같은 시·도에서 단체가 있는 다른 시·군·구를 제안한다.
    let suggestions: ReturnType<typeof pickSuggestions> = [];
    if (result.total === 0 && offset === 0) {
      let nearQuery = supabase
        .from("organizations")
        .select("region_code")
        .eq("status", "published")
        .in("region_code", sameSidoCodes(region, regions));
      if (field) nearQuery = nearQuery.eq("field", field); // 분야 필터가 있으면 그 분야 단체가 있는 지역만 제안
      const { data: near } = await nearQuery;
      suggestions = pickSuggestions(region, regions, (near ?? []).map((o) => o.region_code as string));
    }

    // 답변 기록: 지역·분야·보여 준 단체 ID·시각만 남긴다. (질문 원문·사용자 정보는 저장하지 않는다)
    // 기록 실패가 답변을 막지 않게 한다.
    // 답변 기록 표는 서버 전용이라 관리자 열쇠로 쓴다.
    const { error: logError } = await createAdminClient().from("chat_logs").insert({
      region_code: region.code,
      field,
      org_ids: result.items.map((o) => o.id),
    });
    if (logError) console.error("답변 기록 실패:", logError.message);

    return Response.json({
      status: "ok",
      region: { code: region.code, label: label(region) },
      includeNeighbors,
      field,
      total: result.total,
      ownTotal: result.own_total,
      hasMore: result.has_more,
      guide: guide?.text ?? null,
      guideByAi: guide?.byAi ?? false,
      suggestions,
      items: result.items.map((o) => ({ ...o, regionLabel: label(byCode.get(o.region_code) ?? region) })),
    } satisfies ChatResponse);
  } catch (e) {
    console.error("챗봇 검색 오류:", e instanceof Error ? e.message : e);
    return Response.json({ status: "error", message: "잠시 후 다시 시도해 주세요." } satisfies ChatResponse, { status: 500 });
  }
}
