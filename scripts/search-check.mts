// 지역별 검색 점검 프로그램 (PLAN 작업 8번): `npm run search:check -- 수원시 팔달구`
// 입력한 지역 이름으로 실제 DB를 검색해서 결과를 보여 준다. (.env 값은 출력하지 않는다)
// 맨 뒤에 "인접"을 붙이면 인접 지역 단체도 함께 찾는다.
import { createClient } from "@supabase/supabase-js";
import { searchOrganizations } from "../lib/search/organizations.ts";
import { resolveRegion, type RegionRow } from "../lib/search/regions.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("❌ .env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const args = process.argv.slice(2);
const includeNeighbors = args.at(-1) === "인접";
const text = (includeNeighbors ? args.slice(0, -1) : args).join(" ");
if (!text) {
  console.log("사용법: npm run search:check -- 수원시 팔달구 [인접]");
  process.exit(1);
}

const { data: regions, error } = await supabase.from("regions").select("*");
if (error || !regions) {
  console.log(`❌ 지역 표를 읽지 못했습니다: ${error?.message}`);
  process.exit(1);
}
const label = (r: RegionRow) => `${r.sido} ${r.sigungu}`;
const byCode = new Map((regions as RegionRow[]).map((r) => [r.code, r]));

const resolved = resolveRegion(text, regions as RegionRow[]);
if (resolved.status === "none") {
  console.log(`지역을 알아내지 못했습니다: "${text}"`);
  process.exit(0);
}
if (resolved.status === "ambiguous") {
  console.log(`"${text}"에 해당하는 지역이 여러 곳입니다. 어디인가요?`);
  resolved.candidates.slice(0, 10).forEach((r) => console.log(`  - ${label(r)}`));
  process.exit(0);
}

const result = await searchOrganizations(supabase, { region: resolved.region, includeNeighbors });
console.log(`📍 ${label(resolved.region)}${includeNeighbors ? " + 인접 지역" : ""}: 전체 ${result.total}곳 (본 지역 ${result.own_total}곳)`);
result.items.forEach((o, i) => {
  const where = o.from_neighbor ? ` [인접: ${label(byCode.get(o.region_code) as RegionRow)}]` : "";
  console.log(`${i + 1}. ${o.name} / ${o.field}${where}\n   출처: ${o.source_url}`);
});
if (result.items.length === 0) console.log("찾지 못했습니다. (DB에 없는 단체는 만들어 내지 않습니다)");
if (result.has_more) console.log("… 더 있습니다 (더 보기)");
