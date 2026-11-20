// 엑셀 내려받기 (PLAN 작업 21번, DESIGN 6번): 지금 검색 조건(지역·분야·인접 지역)에 맞는 단체 전부를 .xlsx로 내려 준다.
// - 로그인한 공무원·관리자만. 로그인 사용자 권한으로 읽으므로 공개된 단체만 담긴다. (DB 접근 규칙)
// - 한 번에 최대 1000곳까지만 담는다.
import { canUseChat } from "../../../lib/auth/roles.ts";
import { getCurrentUser } from "../../../lib/auth/server.ts";
import { buildWorkbook, type ExportRow } from "../../../lib/export/workbook.ts";
import { validField } from "../../../lib/search/fields.ts";
import { searchOrganizations } from "../../../lib/search/organizations.ts";
import type { RegionRow } from "../../../lib/search/regions.ts";
import { createClient } from "../../../lib/supabase/server.ts";

const MAX_ROWS = 1000;
const CHUNK = 500;

export async function GET(request: Request): Promise<Response> {
  const current = await getCurrentUser();
  if (!current) return Response.json({ ok: false, message: "로그인이 필요합니다." }, { status: 401 });
  if (!canUseChat(current.role)) {
    return Response.json({ ok: false, message: "공무원 또는 관리자 계정만 이용할 수 있습니다." }, { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const regionCode = params.get("regionCode") ?? "";
  if (!/^\d{5}$/.test(regionCode)) return Response.json({ ok: false, message: "지역을 확인할 수 없습니다." }, { status: 400 });
  const includeNeighbors = params.get("includeNeighbors") === "true";
  const field = validField(params.get("field"));

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("regions").select("*");
    const regions = (data ?? []) as RegionRow[];
    const region = regions.find((r) => r.code === regionCode);
    if (!region) return Response.json({ ok: false, message: "지역을 확인할 수 없습니다." }, { status: 404 });
    const label = (r: RegionRow) => `${r.sido} ${r.sigungu}`;
    const byCode = new Map(regions.map((r) => [r.code, r]));

    const rows: ExportRow[] = [];
    for (let offset = 0; offset < MAX_ROWS; offset += CHUNK) {
      const page = await searchOrganizations(supabase, {
        region, includeNeighbors, field: field ?? undefined, offset, limit: CHUNK, maxLimit: CHUNK,
      });
      for (const o of page.items) {
        rows.push({
          name: o.name,
          regionLabel: label(byCode.get(o.region_code) ?? region),
          field: o.field,
          description: o.description,
          contact_phone: o.contact_phone,
          contact_email: o.contact_email,
          contact_source_url: o.contact_source_url,
          source_url: o.source_url,
          collected_at: o.collected_at,
          needs_review: o.needs_review,
          from_neighbor: o.from_neighbor,
        });
      }
      if (!page.has_more) break;
    }

    const today = new Date().toISOString().slice(0, 10);
    const title = `${label(region)}${includeNeighbors ? " + 인접 지역" : ""}${field ? ` · ${field}` : ""} 시민단체 (${rows.length}곳)`;
    const file = await buildWorkbook(rows, { title, createdOn: today });
    const asciiName = `civic-orgs-${regionCode}-${today.replaceAll("-", "")}.xlsx`;
    const koreanName = encodeURIComponent(`${label(region)} 시민단체 ${today}.xlsx`);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${koreanName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("엑셀 내려받기 오류:", e instanceof Error ? e.message : e);
    return Response.json({ ok: false, message: "잠시 후 다시 시도해 주세요." }, { status: 500 });
  }
}
