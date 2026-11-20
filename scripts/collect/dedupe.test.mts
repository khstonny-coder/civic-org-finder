// 이름 정리·중복 합치기 자동 시험: `npm run test:collect`
// 예시 이름은 경기데이터드림 공개 자료(가평군)에서 실제로 같은 단체가 여러 줄 나온 사례를 본떴다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeDuplicates } from "./dedupe.mts";
import { normalizeName } from "./names.mts";
import { checkOrganization, type CheckedOrg } from "./validate.mts";

const org = (over: Partial<CheckedOrg>): CheckedOrg => ({
  name: "가평군새마을회",
  region_code: "41820", // 경기도 가평군
  field: "지역사회·자원봉사",
  description: "새마을운동",
  source_url: "https://example.org/list",
  collected_at: "2026-11-20T00:00:00.000Z",
  contact_phone: null,
  contact_email: null,
  contact_source_url: null,
  ...over,
});

test("이름 정리: 법인 표기·띄어쓰기·기호를 없앤다", () => {
  assert.equal(normalizeName("(사)가평군새마을회"), "가평군새마을회");
  assert.equal(normalizeName("(사) 가평군 새마을회"), "가평군새마을회");
  assert.equal(normalizeName("㈔가평군새마을회"), "가평군새마을회"); // 전각 법인 표기
  assert.equal(normalizeName("사단법인 가평군새마을회"), "가평군새마을회");
  assert.equal(normalizeName("사)가평군새마을회"), "가평군새마을회"); // 괄호가 빠진 표기
  assert.equal(normalizeName("(재)한강·지키기 가평 지역본부"), "한강지키기가평지역본부");
  assert.equal(normalizeName("수원KYC"), "수원kyc"); // 영문은 소문자로
});

test("이름 정리: 단체 이름 가운데의 글자는 건드리지 않는다", () => {
  assert.equal(normalizeName("사회복지협의회"), "사회복지협의회");
  assert.equal(normalizeName("주민자치위원회"), "주민자치위원회");
});

test("법인 표기만 있는 이름은 단체명 없음으로 거부", () => {
  const r = checkOrganization({
    name: "(사)",
    region_code: "41820",
    description: null,
    source_url: "https://example.org",
    collected_at: "2026-11-20T00:00:00.000Z",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.deepEqual(r.reasons, ["missing_name"]);
});

test("같은 단체가 담당부서별로 여러 줄 나오면 한 건으로 합친다", () => {
  // 공개 자료에서 "열린가평장애인자립생활센터"가 두 줄(담당부서만 다름)로 나온 경우
  const { merged, duplicates } = mergeDuplicates([
    org({ name: "열린가평장애인자립생활센터" }),
    org({ name: "열린가평장애인자립생활센터" }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].count, 2);
});

test("표기만 다른 이름도 합치고, 법인 표기가 있는 더 완전한 이름을 남긴다", () => {
  const { merged } = mergeDuplicates([
    org({ name: "가평군새마을회" }),
    org({ name: "(사)가평군새마을회" }),
    org({ name: "(사) 가평군 새마을회" }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, "(사) 가평군 새마을회"); // 가장 긴 표기
  assert.equal(merged[0].name_normalized, "가평군새마을회");
});

test("같은 이름이라도 지역이 다르면 합치지 않는다", () => {
  const { merged, duplicates } = mergeDuplicates([
    org({ name: "새마을회", region_code: "41820" }),
    org({ name: "새마을회", region_code: "41830" }), // 양평군
  ]);
  assert.equal(merged.length, 2);
  assert.equal(duplicates.length, 0);
});

test("합칠 때 사업내용은 가장 자세한 것, 수집일은 가장 최근 것", () => {
  const { merged } = mergeDuplicates([
    org({ description: "새마을운동", collected_at: "2026-11-01T00:00:00.000Z" }),
    org({ description: "새마을운동, 환경보전, 자원봉사활동, 지역사회복지사업 등", collected_at: "2026-11-20T00:00:00.000Z" }),
  ]);
  assert.equal(merged[0].description, "새마을운동, 환경보전, 자원봉사활동, 지역사회복지사업 등");
  assert.equal(merged[0].collected_at, "2026-11-20T00:00:00.000Z");
});

test("합친 뒤 분야는 자세해진 사업내용으로 다시 정한다", () => {
  const { merged } = mergeDuplicates([
    org({ name: "가평모임", description: "친교", field: "기타" }),
    org({ name: "가평모임", description: "환경감시, 환경캠페인, 환경오염방지", field: "환경" }),
  ]);
  assert.equal(merged[0].field, "환경");
});

test("연락처는 출처가 있는 한 건의 것을 통째로 쓴다", () => {
  const { merged } = mergeDuplicates([
    org({}),
    org({ contact_phone: "031-580-1234", contact_email: null, contact_source_url: "https://example.org/c" }),
  ]);
  assert.equal(merged[0].contact_phone, "031-580-1234");
  assert.equal(merged[0].contact_source_url, "https://example.org/c");
});

test("중복이 없으면 그대로 두고, 순서도 유지한다", () => {
  const { merged, duplicates } = mergeDuplicates([
    org({ name: "가평군새마을회" }),
    org({ name: "청평로타리클럽" }),
    org({ name: "가평군연합민간기동순찰대" }),
  ]);
  assert.deepEqual(merged.map((m) => m.name), ["가평군새마을회", "청평로타리클럽", "가평군연합민간기동순찰대"]);
  assert.equal(duplicates.length, 0);
});
