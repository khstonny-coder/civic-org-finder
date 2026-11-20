// 오류 신고 입력 검사 (PLAN 작업 15번, DESIGN 4.3)
export const REPORT_REASONS = {
  closed: "폐업·해산했어요",
  moved: "이전했어요",
  contact_changed: "연락처가 바뀌었어요",
  other: "기타",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_DETAIL_LENGTH = 200;

export type ParsedReport = { orgId: string; reason: ReportReason; detail: string | null };

export function parseReport(body: unknown): { ok: true; report: ParsedReport } | { ok: false; message: string } {
  const b = (body ?? {}) as { orgId?: unknown; reason?: unknown; detail?: unknown };
  if (typeof b.orgId !== "string" || !UUID.test(b.orgId)) return { ok: false, message: "단체를 확인할 수 없습니다." };
  if (typeof b.reason !== "string" || !(b.reason in REPORT_REASONS)) return { ok: false, message: "신고 사유를 골라 주세요." };
  let detail: string | null = null;
  if (typeof b.detail === "string") {
    const trimmed = b.detail.replace(/\s+/g, " ").trim();
    if (trimmed.length > MAX_DETAIL_LENGTH) return { ok: false, message: `설명은 ${MAX_DETAIL_LENGTH}자 이하로 적어 주세요.` };
    detail = trimmed || null;
  }
  return { ok: true, report: { orgId: b.orgId, reason: b.reason as ReportReason, detail } };
}
