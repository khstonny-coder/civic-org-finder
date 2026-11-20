// DB 저장 프로그램 (PLAN 작업 7번): `npm run collect:save`
// 저장 전 검사·중복 합치기를 마친 결과(data/collected/gg-sample.checked.json)를 organizations 표에 저장하고,
// 저장·제외 건수를 collect_runs 표에 기록한다.
// - 같은 (정리된 이름, 시·군·구)가 이미 있으면 새로 만들지 않고 수집 정보(설명·분야·출처·수집일)만 갱신한다.
//   관리자가 바꾼 공개 상태(status)·"확인 필요"(needs_review)는 건드리지 않는다.
// - 새로 수집한 자료에 연락처가 없으면 기존에 저장된 연락처를 지우지 않는다.
// - 다시 수집하고 싶을 때마다 수동으로 실행한다. (정기 자동 갱신은 만들지 않기로 했다 — PRD)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { MergedOrg } from "./dedupe.mts";

type Checked = {
  accepted: MergedOrg[];
  excluded_count: number;
  excluded_reasons: Record<string, number>;
  duplicates_merged: number;
};

// 어떤 검사 결과를 저장할지: 기본은 시험 수집(gg-sample), --set=gg-full 이면 전체 수집
const setName = process.argv.find((a) => a.startsWith("--set="))?.slice(6) ?? "gg-sample";
if (!/^[a-z0-9-]+$/.test(setName)) throw new Error("--set 값이 올바르지 않습니다.");

const checked: Checked = JSON.parse(
  readFileSync(new URL(`../../data/collected/${setName}.checked.json`, import.meta.url), "utf8"),
);

// 화면 코드용 lib/supabase/admin.ts는 "server-only" 때문에 일반 프로그램에서 못 쓰므로 여기서 직접 연결한다. (.env 값은 출력하지 않는다)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.log("❌ .env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
const keyOf = (o: { name_normalized: string; region_code: string }) => `${o.name_normalized}|${o.region_code}`;

// 1) 이미 저장된 단체를 알아내 "새로 저장"과 "갱신"을 구분해서 센다.
const { data: existing, error: readError } = await supabase
  .from("organizations")
  .select("name_normalized, region_code");
if (readError) {
  console.log(`❌ 기존 단체를 읽지 못했습니다: ${readError.message}`);
  process.exit(1);
}
const existingKeys = new Set((existing ?? []).map(keyOf));
const created = checked.accepted.filter((o) => !existingKeys.has(keyOf(o))).length;
const updated = checked.accepted.length - created;

// 2) 저장한다. 연락처가 있는 건과 없는 건을 나눠서 넣어, 없는 건이 기존 연락처를 지우지 않게 한다.
const base = (o: MergedOrg) => ({
  name: o.name,
  name_normalized: o.name_normalized,
  region_code: o.region_code,
  field: o.field,
  description: o.description,
  source_url: o.source_url,
  collected_at: o.collected_at,
});
const withContact = checked.accepted
  .filter((o) => (o.contact_phone || o.contact_email) && o.contact_source_url)
  .map((o) => ({
    ...base(o),
    contact_phone: o.contact_phone,
    contact_email: o.contact_email,
    contact_source_url: o.contact_source_url,
  }));
const withoutContact = checked.accepted
  .filter((o) => !((o.contact_phone || o.contact_email) && o.contact_source_url))
  .map(base);

for (const rows of [withContact, withoutContact]) {
  if (rows.length === 0) continue;
  const { error } = await supabase.from("organizations").upsert(rows, { onConflict: "name_normalized,region_code" });
  if (error) {
    console.log(`❌ 저장하지 못했습니다: ${error.message}`);
    process.exit(1);
  }
}

// 3) 수집 결과를 기록한다.
const note =
  `신규 ${created}건, 갱신 ${updated}건, 중복 합침 ${checked.duplicates_merged}건` +
  ` (출처: 경기데이터드림 비영리민간단체 현황, ${setName === "gg-full" ? "전체 수집" : "시험 수집"})`;
const { error: runError } = await supabase.from("collect_runs").insert({
  saved_count: checked.accepted.length,
  excluded_count: checked.excluded_count,
  excluded_reasons: checked.excluded_reasons,
  note,
});
if (runError) {
  console.log(`⚠️ 단체는 저장했지만 수집 기록을 남기지 못했습니다: ${runError.message}`);
  process.exit(1);
}

console.log(`✅ 저장 완료: 새로 ${created}건, 갱신 ${updated}건 / 제외 ${checked.excluded_count}건`);
for (const [reason, n] of Object.entries(checked.excluded_reasons)) console.log(`   제외 사유(${reason}): ${n}건`);
