// 엑셀 파일 만들기 시험: `npm run test:search`에 함께 돈다
import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { buildWorkbook, EXPORT_HEADERS, type ExportRow } from "./workbook.ts";

const row = (over: Partial<ExportRow> = {}): ExportRow => ({
  name: "바르게살기운동의왕시협의회",
  regionLabel: "경기도 의왕시",
  field: "지역사회·자원봉사",
  description: "바르게살기운동",
  contact_phone: null,
  contact_email: null,
  contact_source_url: null,
  source_url: "https://example.org/list",
  collected_at: "2026-11-20T05:01:11.188+00:00",
  needs_review: false,
  from_neighbor: false,
  ...over,
});

async function load(rows: ExportRow[]) {
  const buf = await buildWorkbook(rows, { title: "경기도 의왕시 시민단체", createdOn: "2026-11-20" });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb.getWorksheet("시민단체 목록")!;
}

test("제목·안내·머리글·데이터 줄이 들어간다", async () => {
  const ws = await load([row(), row({ name: "수원KYC", regionLabel: "경기도 수원시 팔달구", needs_review: true, from_neighbor: true })]);
  assert.equal(ws.getCell("A1").value, "경기도 의왕시 시민단체");
  assert.match(String(ws.getCell("A2").value), /출처를 확인하세요/);
  assert.deepEqual((ws.getRow(3).values as unknown[]).slice(1), [...EXPORT_HEADERS]);
  assert.equal(ws.getCell("A4").value, "바르게살기운동의왕시협의회");
  assert.equal(ws.getCell("I4").value, "2026-11-20"); // 수집일은 날짜만
  assert.equal(ws.getCell("J5").value, "확인 필요");
  assert.equal(ws.getCell("K5").value, "인접 지역");
  assert.equal(ws.rowCount, 5);
});

test("출처 주소는 링크로 들어간다", async () => {
  const ws = await load([row()]);
  const cell = ws.getCell("H4").value as { text: string; hyperlink: string };
  assert.equal(cell.hyperlink, "https://example.org/list");
});

test("수식처럼 보이는 글은 수식이 아니라 글자로 들어간다", async () => {
  const ws = await load([row({ name: "=HYPERLINK(\"http://evil\")", description: "+1+1" })]);
  const name = ws.getCell("A4").value;
  assert.equal(typeof name, "string");
  assert.equal(name, "=HYPERLINK(\"http://evil\")");
  assert.equal(ws.getCell("D4").value, "+1+1");
});

test("결과가 없어도 머리글만 있는 파일이 만들어진다", async () => {
  const ws = await load([]);
  assert.equal(ws.rowCount, 3);
});
