// 관리자 화면의 계산·입력 검사 (PLAN 작업 19번, DESIGN 3.5·4.3·4.4). DB 없이 계산만 해서 시험하기 쉽게 둔다.
import type { SubmissionPayload } from "../orgs/submission.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** 처리 기한: 신청일 + 3영업일 (토·일만 쉬는 날로 본다. 공휴일은 따지지 않는다) */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let left = days;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

export function dueDateOf(createdAt: string): string {
  return addBusinessDays(new Date(createdAt), 3).toISOString().slice(0, 10);
}

export function isOverdue(createdAt: string, today: string = new Date().toISOString().slice(0, 10)): boolean {
  return dueDateOf(createdAt) < today;
}

export const DIFF_KEYS = [
  "name",
  "region_code",
  "field",
  "description",
  "source_url",
  "contact_phone",
  "contact_email",
  "contact_source_url",
] as const;
export type DiffKey = (typeof DIFF_KEYS)[number];
export type Changes = Partial<Record<DiffKey, { from: string | null; to: string | null }>>;

const norm = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

/** 현재 단체 정보(없으면 새 등록)와 신청 내용을 비교해서 바뀌는 항목만 돌려준다. */
export function diffPayload(current: Partial<Record<DiffKey, unknown>> | null, payload: Partial<SubmissionPayload>): Changes {
  const changes: Changes = {};
  for (const key of DIFF_KEYS) {
    const from = norm(current?.[key]);
    const to = norm(payload[key]);
    if (from !== to) changes[key] = { from, to };
  }
  return changes;
}

export type SubmissionDecision =
  | { decision: "approve" }
  | { decision: "reject"; reason: string };

export function parseSubmissionDecision(body: unknown): { ok: true; value: SubmissionDecision } | { ok: false; message: string } {
  const b = (body ?? {}) as { decision?: unknown; reason?: unknown; typeConfirmed?: unknown };
  if (b.decision === "approve") {
    // 단체 유형(비영리민간단체·공익적 시민단체) 확인 항목을 체크해야 승인할 수 있다. (PRD 승인 절차)
    if (b.typeConfirmed !== true) return { ok: false, message: "단체 유형(비영리민간단체·공익적 시민단체) 확인 항목을 체크해 주세요." };
    return { ok: true, value: { decision: "approve" } };
  }
  if (b.decision === "reject") {
    const reason = typeof b.reason === "string" ? b.reason.replace(/\s+/g, " ").trim() : "";
    if (!reason) return { ok: false, message: "거절 사유를 적어 주세요." };
    if (reason.length > 200) return { ok: false, message: "거절 사유는 200자 이하로 적어 주세요." };
    return { ok: true, value: { decision: "reject", reason } };
  }
  return { ok: false, message: "승인 또는 거절을 골라 주세요." };
}

export type ReportAction = "resolve" | "hide" | "dismiss";
export const REPORT_ACTION_LABELS: Record<ReportAction, string> = {
  resolve: "수정 완료",
  hide: "단체 숨김",
  dismiss: "기각",
};
export function parseReportAction(body: unknown): ReportAction | null {
  const a = (body as { action?: unknown } | null)?.action;
  return a === "resolve" || a === "hide" || a === "dismiss" ? a : null;
}

/** 담당자 본인 확인: 기존 단체를 연결하거나(orgId), 연결 없이 승인해 새 단체 등록을 받는다(orgId 없음) */
export function parseUserApproval(body: unknown): { ok: true; orgId: string | null } | { ok: false; message: string } {
  const b = (body ?? {}) as { orgId?: unknown };
  if (b.orgId === undefined || b.orgId === null || b.orgId === "") return { ok: true, orgId: null };
  if (!isUuid(b.orgId)) return { ok: false, message: "연결할 단체 정보가 올바르지 않습니다." };
  return { ok: true, orgId: b.orgId };
}
