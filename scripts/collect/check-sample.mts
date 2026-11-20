// 저장 전 검사 + 중복 합치기 실행 프로그램: `npm run collect:check`
// 시험 수집 결과(data/collected/gg-sample.json)에
//  1) 저장 전 검사(필수 항목·단체 유형·개인 연락처)를 적용하고  (PLAN 5번)
//  2) 검사를 통과한 단체 가운데 중복을 한 건으로 합쳐서  (PLAN 6번)
// 저장해도 되는 건과 제외할 건(사유 포함)을 보여 주고 data/collected/gg-sample.checked.json에 저장한다.
import { readFileSync, writeFileSync } from "node:fs";
import { mergeDuplicates } from "./dedupe.mts";
import { regionLabel } from "./regions.mts";
import { checkOrganization, REASON_LABELS, type Candidate, type CheckedOrg } from "./validate.mts";

// 어떤 수집 결과를 검사할지: 기본은 시험 수집(gg-sample), --set=gg-full 이면 전체 수집
const setName = process.argv.find((a) => a.startsWith("--set="))?.slice(6) ?? "gg-sample";
if (!/^[a-z0-9-]+$/.test(setName)) throw new Error("--set 값이 올바르지 않습니다.");

const input: Candidate[] = JSON.parse(
  readFileSync(new URL(`../../data/collected/${setName}.json`, import.meta.url), "utf8"),
);

const passed: CheckedOrg[] = [];
const excludedReasons: Record<string, number> = {};
let excludedCount = 0;

input.forEach((candidate, i) => {
  const result = checkOrganization(candidate);
  console.log(`\n${i + 1}. ${candidate.name}`);
  if (result.ok) {
    passed.push(result.org);
    console.log(`   ✅ 검사 통과 — ${regionLabel(result.org.region_code)} / 분야: ${result.org.field}`);
    result.notes.forEach((n) => console.log(`      · ${n}`));
  } else {
    excludedCount += 1;
    for (const reason of result.reasons) excludedReasons[reason] = (excludedReasons[reason] ?? 0) + 1;
    console.log(`   ❌ 제외 — ${result.reasons.map((r) => REASON_LABELS[r] ?? r).join(", ")}`);
  }
});

const { merged, duplicates } = mergeDuplicates(passed);

writeFileSync(
  new URL(`../../data/collected/${setName}.checked.json`, import.meta.url),
  JSON.stringify(
    {
      accepted: merged,
      excluded_count: excludedCount,
      excluded_reasons: excludedReasons,
      duplicates_merged: duplicates.reduce((sum, d) => sum + d.count - 1, 0),
    },
    null,
    2,
  ) + "\n",
);

console.log(`\n검사 통과 ${passed.length}건 → 중복을 합친 뒤 저장할 단체 ${merged.length}건 / 제외 ${excludedCount}건`);
for (const [reason, n] of Object.entries(excludedReasons)) {
  console.log(`   제외 사유: ${REASON_LABELS[reason] ?? reason} ${n}건`);
}
if (duplicates.length === 0) {
  console.log("   중복으로 합친 단체: 없음");
} else {
  for (const d of duplicates) {
    console.log(`   중복으로 합친 단체: ${d.names.join(" / ")} (${regionLabel(d.region_code)}) ${d.count}줄 → 1건`);
  }
}
