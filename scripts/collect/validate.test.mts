// 저장 전 검사 자동 시험: `npm run test:collect`
// 예시 값을 넣어서 검사 규칙이 의도대로 동작하는지 확인한다.
import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyField } from "./fields.mts";
import { matchRegion } from "./regions.mts";
import { checkOrganization, filterContact, stripPersonalText, type Candidate } from "./validate.mts";

const base: Candidate = {
  name: "마포환경연합",
  region_code: "11440", // 서울 마포구
  description: "환경보전 활동",
  source_url: "https://example.org/list",
  collected_at: "2026-11-20T00:00:00.000Z",
};

function reasons(c: Partial<Candidate>): string[] {
  const r = checkOrganization({ ...base, ...c });
  return r.ok ? [] : r.reasons;
}

test("정상 단체는 저장 가능하고 분야가 정해진다", () => {
  const r = checkOrganization(base);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.org.field, "환경");
});

test("검사 1: 필수 항목이 없으면 거부", () => {
  assert.deepEqual(reasons({ name: " " }), ["missing_name"]);
  assert.deepEqual(reasons({ region_code: null }), ["missing_region"]);
  assert.deepEqual(reasons({ region_code: "99999" }), ["missing_region"]);
  assert.deepEqual(reasons({ source_url: null }), ["missing_source_url"]);
  assert.deepEqual(reasons({ source_url: "javascript:alert(1)" }), ["invalid_source_url"]);
});

test("검사 2: 협동조합·사회적 기업 제외", () => {
  assert.deepEqual(reasons({ name: "마포돌봄사회적협동조합" }), ["excluded_cooperative"]);
  assert.deepEqual(reasons({ name: "행복사회적기업" }), ["excluded_cooperative"]);
});

test("검사 2: 종교·친목·노조 단체 제외", () => {
  assert.deepEqual(reasons({ name: "새빛교회" }), ["excluded_religion"]);
  assert.deepEqual(reasons({ name: "OO지역 천주교 봉사회" }), ["excluded_religion"]);
  assert.deepEqual(reasons({ name: "경남향우회" }), ["excluded_social_club"]);
  assert.deepEqual(reasons({ name: "마포구청 노동조합" }), ["excluded_labor_union"]);
});

test("검사 2: 사업내용만 보고 종교 활동 단체 제외", () => {
  assert.deepEqual(reasons({ name: "새벽모임", description: "선교 및 예배" }), ["excluded_religion"]);
});

test("검사 2: 이름에 비슷한 글자가 있어도 일반 시민단체는 통과", () => {
  assert.equal(checkOrganization({ ...base, name: "한강지키기시민모임" }).ok, true);
  assert.equal(checkOrganization({ ...base, name: "마포인권센터", description: "인권 상담" }).ok, true);
});

test("검사 3: 휴대전화 번호는 제거, 기관 대표전화는 유지", () => {
  const mobile = filterContact({ phone: "010-1234-5678", source_url: "https://example.org" });
  assert.equal(mobile.phone, null);
  const office = filterContact({ phone: "02-123-4567", source_url: "https://example.org" });
  assert.equal(office.phone, "02-123-4567");
});

test("검사 3: 무료 메일은 대표 이메일로 표시된 경우만 유지", () => {
  const plain = filterContact({ email: "someone@gmail.com", source_url: "https://example.org" });
  assert.equal(plain.email, null);
  const labeled = filterContact({ email: "ngo@gmail.com", labeled_representative: true, source_url: "https://example.org" });
  assert.equal(labeled.email, "ngo@gmail.com");
  const org = filterContact({ email: "info@ngo.or.kr", source_url: "https://example.org" });
  assert.equal(org.email, "info@ngo.or.kr");
});

test("검사 3: 출처가 없는 연락처는 전부 제거", () => {
  const r = filterContact({ phone: "02-123-4567", email: "info@ngo.or.kr" });
  assert.equal(r.phone, null);
  assert.equal(r.email, null);
  assert.equal(r.source_url, null);
});

test("검사 3: 사업내용에 섞인 휴대전화·이메일·주민번호 모양은 지운다", () => {
  const r = stripPersonalText("문의 010-1234-5678 / me@gmail.com / 900101-1234567 환경 교육");
  assert.equal(r.removed, true);
  assert.ok(!/010|@|900101/.test(r.text));
  assert.ok(r.text.includes("환경 교육"));
});

test("검사 3: 정상 사업내용은 그대로", () => {
  const r = stripPersonalText("환경감시, 환경캠페인");
  assert.equal(r.removed, false);
  assert.equal(r.text, "환경감시, 환경캠페인");
});

test("연락처는 검사를 통과한 값만 결과에 들어간다", () => {
  const r = checkOrganization({
    ...base,
    contact: { phone: "010-1111-2222", email: "info@ngo.or.kr", source_url: "https://example.org/c" },
  });
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.org.contact_phone, null);
    assert.equal(r.org.contact_email, "info@ngo.or.kr");
    assert.equal(r.org.contact_source_url, "https://example.org/c");
  }
});

test("분야 판정: 가장 많이 맞는 분야, 동점이면 앞 분야, 없으면 기타", () => {
  assert.equal(classifyField("바르게살기운동의왕시협의회", "바르게살기운동"), "지역사회·자원봉사");
  assert.equal(classifyField("수원KYC", "청년교육,평화통일, 인권복지실현사업등"), "인권·평화");
  assert.equal(classifyField("새시대", "실업자,저소득층지원"), "복지·돌봄"); // 복지·돌봄 1 = 경제·일자리 1 → 앞 분야
  assert.equal(classifyField("ABC모임", "친교"), "기타");
});

test("지역 연결: 코드가 맞으면 그 지역, 구가 있는 시는 주소의 구로 정한다", () => {
  assert.equal(matchRegion({ sido: "경기도", sigunCode: "41430", sigunName: "의왕시" }).code, "41430");
  assert.equal(
    matchRegion({ sido: "경기도", sigunName: "수원시", addresses: ["경기도 수원시 영통구 광교로 1"] }).code,
    "41117",
  );
  assert.equal(matchRegion({ sido: "경기도", sigunName: "수원시", addresses: ["경기도 수원시"] }).code, null);
  assert.equal(matchRegion({ sido: "경기도", sigunName: "없는시" }).code, null);
});
