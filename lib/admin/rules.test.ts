// 관리자 규칙 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { addBusinessDays, diffPayload, dueDateOf, isOverdue, parseReportAction, parseSubmissionDecision, parseUserApproval } from "./rules.ts";

test("3영업일: 주말은 건너뛴다", () => {
  assert.equal(dueDateOf("2026-11-16T09:00:00Z"), "2026-11-19"); // 월 → 목
  assert.equal(dueDateOf("2026-11-19T09:00:00Z"), "2026-11-24"); // 목 → 화 (토·일 건너뜀)
  assert.equal(dueDateOf("2026-11-20T09:00:00Z"), "2026-11-25"); // 금 → 수
  assert.equal(dueDateOf("2026-11-21T09:00:00Z"), "2026-11-25"); // 토 → 수
  assert.equal(addBusinessDays(new Date("2026-11-16T00:00:00Z"), 0).toISOString().slice(0, 10), "2026-11-16");
});

test("처리 기한이 지났는지", () => {
  assert.equal(isOverdue("2026-11-16T09:00:00Z", "2026-11-19"), false);
  assert.equal(isOverdue("2026-11-16T09:00:00Z", "2026-11-20"), true);
});

test("바뀌는 항목만 비교한다 (빈 값과 null은 같게 본다)", () => {
  const current = { name: "푸른내일", field: "환경", description: "", contact_phone: "031-123-4567" };
  const c = diffPayload(current, { name: "푸른내일", field: "복지·돌봄", description: null, contact_phone: "031-123-4567", source_url: "https://a.kr" });
  assert.deepEqual(c, { field: { from: "환경", to: "복지·돌봄" }, source_url: { from: null, to: "https://a.kr" } });
});

test("새 등록은 값이 있는 모든 항목이 바뀜으로 나온다", () => {
  const c = diffPayload(null, { name: "새단체", region_code: "41430", field: "환경", source_url: "https://a.kr" });
  assert.deepEqual(Object.keys(c).sort(), ["field", "name", "region_code", "source_url"]);
});

test("승인은 단체 유형 확인 체크가 있어야 하고, 거절은 사유가 있어야 한다", () => {
  assert.equal(parseSubmissionDecision({ decision: "approve" }).ok, false);
  assert.equal(parseSubmissionDecision({ decision: "approve", typeConfirmed: true }).ok, true);
  assert.equal(parseSubmissionDecision({ decision: "reject", reason: "  " }).ok, false);
  assert.equal(parseSubmissionDecision({ decision: "reject", reason: "단체 유형이 맞지 않음" }).ok, true);
  assert.equal(parseSubmissionDecision({ decision: "reject", reason: "가".repeat(201) }).ok, false);
  assert.equal(parseSubmissionDecision({}).ok, false);
});

test("신고 처리 동작과 담당자 승인 입력", () => {
  assert.equal(parseReportAction({ action: "hide" }), "hide");
  assert.equal(parseReportAction({ action: "delete" }), null);
  assert.deepEqual(parseUserApproval({}), { ok: true, orgId: null });
  assert.equal(parseUserApproval({ orgId: "abc" }).ok, false);
  assert.deepEqual(parseUserApproval({ orgId: "eb3adc28-ba74-49bd-8c57-d3c54a1de2fc" }), { ok: true, orgId: "eb3adc28-ba74-49bd-8c57-d3c54a1de2fc" });
});
