// 지역 이름 찾기 자동 시험: `npm run test:search`
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolveRegion, type RegionRow } from "./regions.ts";
import { pickSuggestions } from "./suggest.ts";
import { detectField, validField } from "./fields.ts";

test("분야 필터: 목록에 있는 분야만 인정한다", () => {
  assert.equal(validField("환경"), "환경");
  assert.equal(validField("지역사회·자원봉사"), "지역사회·자원봉사");
  assert.equal(validField("해킹"), null);
  assert.equal(validField(undefined), null);
  assert.equal(validField(3), null);
});

test("분야 필터: 질문 속 분야 낱말을 알아차리되, 섞이면 추측하지 않는다", () => {
  assert.equal(detectField("강남구에서 환경 단체 알려줘"), "환경");
  assert.equal(detectField("마포구 청소년 교육 단체"), "교육·청소년"); // 한 분야의 두 낱말
  assert.equal(detectField("수원시 자원봉사 단체"), "지역사회·자원봉사");
  assert.equal(detectField("마포구 환경이랑 복지 단체"), null); // 두 분야가 섞임
  assert.equal(detectField("마포구 시민단체"), null);
});

const regions: RegionRow[] = JSON.parse(readFileSync(new URL("../../data/regions.json", import.meta.url), "utf8"));
const codeOf = (text: string) => {
  const r = resolveRegion(text, regions);
  return r.status === "found" ? r.region.code : r.status;
};

test("정식 이름으로 찾는다", () => {
  assert.equal(codeOf("경기도 가평군"), "41820");
  assert.equal(codeOf("수원시 장안구"), "41111");
});

test("문장 속에서도 찾는다", () => {
  assert.equal(codeOf("가평군에서 간담회를 하려는데 시민단체 알려줘"), "41820");
});

test("약칭으로 찾는다", () => {
  assert.equal(codeOf("서울 중구"), "11140");
  assert.equal(codeOf("부산 중구 단체"), "26110");
});

test("여러 시·도에 있는 이름은 추측하지 않고 후보를 돌려준다", () => {
  const r = resolveRegion("중구", regions);
  assert.equal(r.status, "ambiguous");
  if (r.status === "ambiguous") assert.ok(r.candidates.length >= 5);
});

test("시 이름만 말하면 그 시의 구들을 후보로 돌려준다", () => {
  const r = resolveRegion("수원시", regions);
  assert.equal(r.status, "ambiguous");
  if (r.status === "ambiguous") assert.equal(r.candidates.length, 4);
});

test("옛 명칭으로도 찾는다", () => {
  assert.equal(codeOf("연기군"), "36110");
});

test("0곳 제안: 같은 시·도에서 단체가 있는 지역만, 많은 곳부터", () => {
  const gapyeong = regions.find((r) => r.code === "41820") as RegionRow; // 경기도 가평군
  const codes = ["41430", "41430", "41220", "41820", "11140"]; // 의왕 2, 평택 1, 가평 자신, 서울 중구(다른 시·도)
  const s = pickSuggestions(gapyeong, regions, codes);
  assert.deepEqual(s.map((x) => [x.code, x.count]), [["41430", 2], ["41220", 1]]);
  assert.equal(pickSuggestions(gapyeong, regions, ["11140"]).length, 0); // 같은 시·도에 단체가 없으면 빈 목록
  assert.equal(pickSuggestions(gapyeong, regions, codes, 1).length, 1); // 개수 제한
});

test("지역이 없으면 none", () => {
  assert.equal(codeOf("간담회 장소 추천해줘"), "none");
  assert.equal(codeOf(""), "none");
});
