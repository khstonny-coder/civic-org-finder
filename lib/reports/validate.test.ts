// 오류 신고 입력 검사 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReport } from "./validate.ts";

const id = "eb3adc28-ba74-49bd-8c57-d3c54a1de2fc";

test("올바른 신고는 통과하고 설명의 공백을 정리한다", () => {
  const r = parseReport({ orgId: id, reason: "moved", detail: "  사무실이\n 이전했습니다  " });
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.report, { orgId: id, reason: "moved", detail: "사무실이 이전했습니다" });
});

test("설명은 없어도 된다", () => {
  const r = parseReport({ orgId: id, reason: "closed" });
  assert.equal(r.ok && r.report.detail, null);
});

test("단체 ID·사유가 잘못되면 거부", () => {
  assert.equal(parseReport({ orgId: "abc", reason: "closed" }).ok, false);
  assert.equal(parseReport({ orgId: id, reason: "spam" }).ok, false);
  assert.equal(parseReport({ orgId: id }).ok, false);
  assert.equal(parseReport(null).ok, false);
});

test("설명이 너무 길면 거부", () => {
  assert.equal(parseReport({ orgId: id, reason: "other", detail: "가".repeat(201) }).ok, false);
  assert.equal(parseReport({ orgId: id, reason: "other", detail: "가".repeat(200) }).ok, true);
});
