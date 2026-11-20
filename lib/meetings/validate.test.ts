// 간담회 입력 검사 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import { isRealDate, parseChange, parseMeeting, purgeDate } from "./validate.ts";

const id1 = "eb3adc28-ba74-49bd-8c57-d3c54a1de2fc";
const id2 = "11111111-2222-4333-8444-555555555555";
const today = "2026-11-20";

test("삭제 예정일은 간담회일 + 90일", () => {
  assert.equal(purgeDate("2026-12-01"), "2027-03-01");
  assert.equal(purgeDate("2026-11-20"), "2027-02-18");
});

test("실제 있는 날짜만 통과", () => {
  assert.equal(isRealDate("2026-12-01"), true);
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("2026-1-1"), false);
  assert.equal(isRealDate("내일"), false);
});

test("정상 간담회: 제목 공백 정리, 중복 단체 제거", () => {
  const r = parseMeeting({ title: "  환경  간담회 ", heldOn: "2026-12-01", regionCode: "41430", orgIds: [id1, id1, id2] }, today);
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.meeting, { title: "환경 간담회", heldOn: "2026-12-01", regionCode: "41430", orgIds: [id1, id2] });
});

test("지역·초청 단체는 없어도 된다", () => {
  const r = parseMeeting({ title: "간담회", heldOn: "2026-12-01" }, today);
  assert.equal(r.ok && r.meeting.regionCode, null);
  assert.equal(r.ok && r.meeting.orgIds.length, 0);
});

test("제목 없음·긴 제목·잘못된 날짜는 거부", () => {
  assert.equal(parseMeeting({ title: " ", heldOn: "2026-12-01" }, today).ok, false);
  assert.equal(parseMeeting({ title: "가".repeat(101), heldOn: "2026-12-01" }, today).ok, false);
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-13-01" }, today).ok, false);
});

test("삭제 기한이 이미 지난 날짜는 거부, 아슬아슬하게 남은 날짜는 허용", () => {
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-08-01" }, today).ok, false); // 2026-10-30에 삭제
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-08-22" }, today).ok, true); // 2026-11-20까지 보관
});

test("초청 단체는 50곳까지, 형식이 틀리면 거부", () => {
  const many = Array.from({ length: 51 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-12-01", orgIds: many }, today).ok, false);
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-12-01", orgIds: ["x"] }, today).ok, false);
  assert.equal(parseMeeting({ title: "a", heldOn: "2026-12-01", regionCode: "abc" }, today).ok, false);
});

test("수정 요청: 참석 상태 / 단체 추가 / 단체 빼기", () => {
  assert.deepEqual(parseChange({ orgId: id1, attendance: "attending" }), { ok: true, change: { kind: "attendance", orgId: id1, attendance: "attending" } });
  assert.deepEqual(parseChange({ addOrgIds: [id1, id1, id2] }), { ok: true, change: { kind: "add", orgIds: [id1, id2] } });
  assert.deepEqual(parseChange({ removeOrgId: id1 }), { ok: true, change: { kind: "remove", orgId: id1 } });
  assert.equal(parseChange({ orgId: id1, attendance: "maybe" }).ok, false);
  assert.equal(parseChange({ addOrgIds: [] }).ok, false);
  assert.equal(parseChange({}).ok, false);
});
