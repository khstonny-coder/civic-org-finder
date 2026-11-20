// 단체 신청 입력 검사 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseOrgName, parseSubmission } from "./submission.ts";

const base = { name: " 푸른  내일 ", region_code: "41430", field: "환경", source_url: "https://example.org/about" };

test("정상 신청: 공백 정리, 없는 항목은 null", () => {
  const r = parseSubmission(base);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.payload.name, "푸른 내일");
    assert.equal(r.payload.description, null);
    assert.equal(r.payload.contact_phone, null);
  }
});

test("필수 항목이 없거나 틀리면 거부", () => {
  assert.equal(parseSubmission({ ...base, name: "가" }).ok, false);
  assert.equal(parseSubmission({ ...base, region_code: "의왕" }).ok, false);
  assert.equal(parseSubmission({ ...base, field: "없는분야" }).ok, false);
  assert.equal(parseSubmission({ ...base, source_url: "" }).ok, false);
  assert.equal(parseSubmission({ ...base, source_url: "javascript:alert(1)" }).ok, false);
  assert.equal(parseSubmission({ ...base, source_url: "example.org" }).ok, false);
  assert.equal(parseSubmission(null).ok, false);
});

test("소개가 너무 길면 거부, 소개에 섞인 휴대전화는 지운다", () => {
  assert.equal(parseSubmission({ ...base, description: "가".repeat(201) }).ok, false);
  const r = parseSubmission({ ...base, description: "환경 지킴이 활동 문의 010-1234-5678" });
  assert.equal(r.ok && r.payload.description, "환경 지킴이 활동 문의");
  assert.equal(r.ok && r.notes.length, 1);
});

test("연락처: 대표 전화·이메일은 출처가 있을 때만 남긴다", () => {
  const r = parseSubmission({
    ...base,
    contact_phone: "031-123-4567",
    contact_email: "info@greentomorrow.or.kr",
    contact_source_url: "https://example.org/contact",
  });
  assert.equal(r.ok && r.payload.contact_phone, "031-123-4567");
  assert.equal(r.ok && r.payload.contact_email, "info@greentomorrow.or.kr");
  const noSource = parseSubmission({ ...base, contact_phone: "031-123-4567" });
  assert.equal(noSource.ok && noSource.payload.contact_phone, null);
  assert.equal(noSource.ok && noSource.payload.contact_source_url, null);
});

test("휴대전화는 지운다 (개인 연락처 저장 금지)", () => {
  const r = parseSubmission({ ...base, contact_phone: "010-1234-5678", contact_source_url: "https://example.org/c" });
  assert.equal(r.ok && r.payload.contact_phone, null);
});

test("가입 단체명 검사", () => {
  assert.equal(parseOrgName("  푸른 내일 "), "푸른 내일");
  assert.equal(parseOrgName("가"), null);
  assert.equal(parseOrgName("가".repeat(101)), null);
  assert.equal(parseOrgName(undefined), null);
});
