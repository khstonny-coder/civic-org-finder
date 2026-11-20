// 가입 허용 도메인·역할 규칙 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedDomains, canUseChat, isAllowedOfficialEmail, shouldBecomeOfficial } from "./roles.ts";

const domains = allowedDomains(undefined);

test("기본 허용 도메인은 go.kr, korea.kr이고 .env 추가분이 더해진다", () => {
  assert.deepEqual(domains, ["go.kr", "korea.kr"]);
  assert.deepEqual(allowedDomains(" @Example.or.kr, , bad ,go.kr"), ["go.kr", "korea.kr", "example.or.kr"]);
});

test("허용 도메인과 그 하위 도메인은 통과", () => {
  assert.equal(isAllowedOfficialEmail("a@korea.kr", domains), true);
  assert.equal(isAllowedOfficialEmail("a@mapo.seoul.go.kr", domains), true);
  assert.equal(isAllowedOfficialEmail("A@GO.KR", domains), true);
});

test("이름만 비슷하거나 일반 메일은 거부", () => {
  assert.equal(isAllowedOfficialEmail("a@evilgo.kr", domains), false);
  assert.equal(isAllowedOfficialEmail("a@go.kr.evil.com", domains), false);
  assert.equal(isAllowedOfficialEmail("a@gmail.com", domains), false);
  assert.equal(isAllowedOfficialEmail("go.kr", domains), false);
  assert.equal(isAllowedOfficialEmail("a b@go.kr", domains), false);
});

test("챗봇은 공무원·관리자만", () => {
  assert.equal(canUseChat("official"), true);
  assert.equal(canUseChat("admin"), true);
  assert.equal(canUseChat("org"), false);
  assert.equal(canUseChat("org_pending"), false);
  assert.equal(canUseChat(null), false);
});

const base = { role: "org_pending", orgId: null, orgNameRequested: null, email: "a@korea.kr", emailConfirmed: true, domains } as const;

test("공무원 승격: 인증 완료 + 허용 도메인 + 승인 대기일 때만", () => {
  assert.equal(shouldBecomeOfficial({ ...base }), true);
  assert.equal(shouldBecomeOfficial({ ...base, emailConfirmed: false }), false); // 인증 전
  assert.equal(shouldBecomeOfficial({ ...base, email: "a@gmail.com" }), false); // 도메인
  assert.equal(shouldBecomeOfficial({ ...base, orgNameRequested: "푸른내일" }), false); // 단체 담당자 신청
  assert.equal(shouldBecomeOfficial({ ...base, role: "admin" }), false); // 이미 다른 역할이면 건드리지 않음
  assert.equal(shouldBecomeOfficial({ ...base, role: "official" }), false);
});
