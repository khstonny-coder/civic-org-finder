// 엑셀 파일 만들기 (PLAN 작업 21번, PRD 5-nice): 검색 결과 단체 목록을 .xlsx로 만든다.
// - 공개된 정보만 담는다: 호출하는 쪽이 로그인 사용자 권한(공개 단체만 보임)으로 읽은 결과만 넘긴다.
// - 개인정보는 담을 수 없다: 이 표에는 저장 단계에서 이미 걸러진 기관 대표 연락처(출처 포함)만 있다.
// - 문자열은 문자열 칸으로만 넣어, "=1+1" 같은 글이 엑셀 수식으로 실행되지 않게 한다.
import ExcelJS from "exceljs";

export type ExportRow = {
  name: string;
  regionLabel: string; // "경기도 의왕시"
  field: string;
  description: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
  source_url: string;
  collected_at: string;
  needs_review: boolean;
  from_neighbor: boolean;
};

export const EXPORT_HEADERS = [
  "단체명", "지역", "분야", "소개", "대표 전화", "대표 이메일", "연락처 출처", "출처", "수집일", "확인 필요", "비고",
] as const;

const WIDTHS = [28, 22, 16, 44, 16, 26, 30, 40, 12, 10, 12];

export async function buildWorkbook(rows: ExportRow[], meta: { title: string; createdOn: string }): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "우리동네 시민단체 찾기";
  const ws = wb.addWorksheet("시민단체 목록", { views: [{ state: "frozen", ySplit: 3 }] });

  ws.addRow([meta.title]).font = { bold: true, size: 13 };
  ws.addRow([`내려받은 날 ${meta.createdOn} · 연락 전 반드시 출처를 확인하세요. 정보는 수집일 기준이며 최신이 아닐 수 있습니다.`]);
  const header = ws.addRow([...EXPORT_HEADERS]);
  header.font = { bold: true };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6F4EA" } };
  ws.columns = WIDTHS.map((width) => ({ width }));

  for (const r of rows) {
    const row = ws.addRow([
      r.name,
      r.regionLabel,
      r.field,
      r.description ?? "",
      r.contact_phone ?? "",
      r.contact_email ?? "",
      r.contact_source_url ?? "",
      r.source_url,
      r.collected_at.slice(0, 10),
      r.needs_review ? "확인 필요" : "",
      r.from_neighbor ? "인접 지역" : "",
    ]);
    // 출처 주소는 누르면 열리는 링크로 만든다. (http·https 주소만 링크로 인정)
    for (const col of [7, 8]) {
      const cell = row.getCell(col);
      const value = String(cell.value ?? "");
      if (/^https?:\/\//i.test(value)) cell.value = { text: value, hyperlink: value };
    }
    row.alignment = { vertical: "top", wrapText: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
