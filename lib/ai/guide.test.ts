// AI 안내 문장 도우미 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanGuide, fallbackGuide } from "./guide.ts";

const base = { regionLabel: "경기도 의왕시", total: 3, names: ["가", "나", "다"], includeNeighbors: false };

test("대체 문장: 개수와 지역을 말한다", () => {
  assert.match(fallbackGuide(base), /경기도 의왕시에서 시민단체 3곳/);
  assert.match(fallbackGuide({ ...base, includeNeighbors: true }), /인접 지역/);
});

test("대체 문장: 0곳이면 찾지 못했다고 말한다", () => {
  assert.match(fallbackGuide({ ...base, total: 0 }), /찾지 못했습니다/);
});

test("AI 문장 다듬기: 줄바꿈 정리, 링크·너무 짧거나 긴 글은 버린다", () => {
  assert.equal(cleanGuide("의왕시에서\n3곳을   찾았습니다."), "의왕시에서 3곳을 찾았습니다.");
  assert.equal(cleanGuide("자세한 건 https://example.com 참고하세요."), null);
  assert.equal(cleanGuide("네"), null);
  assert.equal(cleanGuide("가".repeat(201)), null);
  assert.equal(cleanGuide(undefined), null);
});
