// 조회 오류 판단 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { hasQueryError } from "./query.ts";

test("하나라도 error가 있으면 오류로 본다", () => {
  assert.equal(hasQueryError({ data: [], error: null }, { data: null, error: { message: "x" } }), true);
});

test("모두 정상이거나 error 칸이 없는 결과는 오류가 아니다", () => {
  assert.equal(hasQueryError({ data: [], error: null }, { data: null }), false);
  assert.equal(hasQueryError(null, undefined), false);
  assert.equal(hasQueryError(), false);
});
