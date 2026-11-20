// 페이지 나눠 받기 시험: `npm run test:collect`
import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchAllPages, type Page } from "./paginate.mts";

const makeServer = (total: number) => async (index: number, size: number): Promise<Page<number>> => {
  const start = (index - 1) * size;
  const rows = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => start + i + 1);
  return { rows, total };
};

test("모든 쪽을 차례로 받아 이어 붙인다", async () => {
  const r = await fetchAllPages(makeServer(2500), { pageSize: 1000 });
  assert.equal(r.rows.length, 2500);
  assert.equal(r.rows[0], 1);
  assert.equal(r.rows[2499], 2500);
  assert.equal(r.total, 2500);
  assert.equal(r.truncated, false);
});

test("딱 나누어떨어져도 빈 쪽을 더 요청하지 않는다", async () => {
  let calls = 0;
  const server = makeServer(2000);
  const r = await fetchAllPages(async (i, s) => { calls++; return server(i, s); }, { pageSize: 1000 });
  assert.equal(r.rows.length, 2000);
  assert.equal(calls, 2);
});

test("자료가 0건이면 한 번만 묻고 끝낸다", async () => {
  let calls = 0;
  const r = await fetchAllPages(async () => { calls++; return { rows: [], total: 0 }; }, { pageSize: 1000 });
  assert.equal(r.rows.length, 0);
  assert.equal(calls, 1);
});

test("서버가 총 건수보다 일찍 빈 쪽을 주면 멈춘다 (무한 반복 방지)", async () => {
  const r = await fetchAllPages(async (i) => (i === 1 ? { rows: [1, 2, 3], total: 10 } : { rows: [], total: 10 }), { pageSize: 3 });
  assert.equal(r.rows.length, 3);
});

test("최대 건수를 넘으면 거기서 자르고 잘렸다고 알린다", async () => {
  const r = await fetchAllPages(makeServer(5000), { pageSize: 1000, maxRows: 1500 });
  assert.equal(r.rows.length, 1500);
  assert.equal(r.truncated, true);
});

test("진행 상황을 알려 준다", async () => {
  const seen: number[] = [];
  await fetchAllPages(makeServer(25), { pageSize: 10, onPage: (got) => seen.push(got) });
  assert.deepEqual(seen, [10, 20, 25]);
});
