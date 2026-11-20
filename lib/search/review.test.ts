// "확인 필요" 판단 시험: `npm run test:search`
import assert from "node:assert/strict";
import { test } from "node:test";
import { isStale, reviewReason } from "./review.ts";

const now = new Date("2026-11-20T00:00:00.000Z");

test("1년이 지나지 않았으면 표시하지 않는다", () => {
  assert.equal(isStale("2025-11-21T00:00:00.000Z", now), false);
  assert.equal(isStale("2026-11-01T00:00:00.000Z", now), false);
});

test("정확히 1년째부터 표시한다", () => {
  assert.equal(isStale("2025-11-20T00:00:00.000Z", now), true);
  assert.equal(isStale("2024-01-01T00:00:00.000Z", now), true);
});

test("날짜를 읽을 수 없으면 확인 필요로 본다", () => {
  assert.equal(isStale("이상한값", now), true);
});

test("이유: 신고가 우선, 그다음 오래됨, 둘 다 아니면 없음", () => {
  assert.equal(reviewReason({ collected_at: "2026-11-01T00:00:00.000Z", needs_review: true }, now), "reported");
  assert.equal(reviewReason({ collected_at: "2020-01-01T00:00:00.000Z", needs_review: true }, now), "reported");
  assert.equal(reviewReason({ collected_at: "2020-01-01T00:00:00.000Z", needs_review: false }, now), "old");
  assert.equal(reviewReason({ collected_at: "2026-11-01T00:00:00.000Z", needs_review: false }, now), null);
});
