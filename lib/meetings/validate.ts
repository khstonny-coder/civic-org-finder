// 간담회 입력 검사 (PLAN 작업 16번, PRD 7번: 간담회일 90일 뒤 자동 삭제)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ATTENDANCE = { undecided: "미정", attending: "참석", absent: "불참" } as const;
export type Attendance = keyof typeof ATTENDANCE;

export const MAX_TITLE_LENGTH = 100;
export const MAX_INVITED = 50;
export const RETENTION_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-12-01" 형식의 실제 있는 날짜인가 */
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** 삭제 예정일(간담회일 + 90일). DB의 purge_after와 같은 계산이다. */
export function purgeDate(heldOn: string): string {
  return new Date(new Date(`${heldOn}T00:00:00.000Z`).getTime() + RETENTION_DAYS * DAY_MS).toISOString().slice(0, 10);
}

export type ParsedMeeting = { title: string; heldOn: string; regionCode: string | null; orgIds: string[] };

export function parseMeeting(
  body: unknown,
  today: string = new Date().toISOString().slice(0, 10),
): { ok: true; meeting: ParsedMeeting } | { ok: false; message: string } {
  const b = (body ?? {}) as { title?: unknown; heldOn?: unknown; regionCode?: unknown; orgIds?: unknown };

  const title = typeof b.title === "string" ? b.title.replace(/\s+/g, " ").trim() : "";
  if (!title) return { ok: false, message: "간담회 제목을 적어 주세요." };
  if (title.length > MAX_TITLE_LENGTH) return { ok: false, message: `제목은 ${MAX_TITLE_LENGTH}자 이하로 적어 주세요.` };

  if (typeof b.heldOn !== "string" || !isRealDate(b.heldOn)) {
    return { ok: false, message: "간담회 날짜를 올바르게 입력해 주세요." };
  }
  // 이미 삭제 기한(간담회일 + 90일)이 지난 날짜는 만들자마자 지워지므로 받지 않는다.
  if (purgeDate(b.heldOn) < today) {
    return { ok: false, message: `간담회일 ${RETENTION_DAYS}일 뒤 자동 삭제되므로, 이미 기한이 지난 날짜는 입력할 수 없습니다.` };
  }

  let regionCode: string | null = null;
  if (b.regionCode !== undefined && b.regionCode !== null && b.regionCode !== "") {
    if (typeof b.regionCode !== "string" || !/^\d{5}$/.test(b.regionCode)) return { ok: false, message: "지역 정보가 올바르지 않습니다." };
    regionCode = b.regionCode;
  }

  let orgIds: string[] = [];
  if (b.orgIds !== undefined) {
    if (!Array.isArray(b.orgIds) || b.orgIds.some((id) => typeof id !== "string" || !UUID.test(id))) {
      return { ok: false, message: "초청 단체 정보가 올바르지 않습니다." };
    }
    orgIds = [...new Set(b.orgIds as string[])];
    if (orgIds.length > MAX_INVITED) return { ok: false, message: `한 간담회에는 단체를 ${MAX_INVITED}곳까지 초청할 수 있습니다.` };
  }
  return { ok: true, meeting: { title, heldOn: b.heldOn, regionCode, orgIds } };
}

export type MeetingChange =
  | { kind: "attendance"; orgId: string; attendance: Attendance }
  | { kind: "add"; orgIds: string[] }
  | { kind: "remove"; orgId: string };

/** 간담회 수정 요청: 참석 상태 변경 / 단체 추가 / 단체 빼기 중 하나 */
export function parseChange(body: unknown): { ok: true; change: MeetingChange } | { ok: false; message: string } {
  const b = (body ?? {}) as { orgId?: unknown; attendance?: unknown; addOrgIds?: unknown; removeOrgId?: unknown };
  const isId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

  if (b.attendance !== undefined) {
    if (!isId(b.orgId) || typeof b.attendance !== "string" || !(b.attendance in ATTENDANCE)) {
      return { ok: false, message: "참석 상태 정보가 올바르지 않습니다." };
    }
    return { ok: true, change: { kind: "attendance", orgId: b.orgId, attendance: b.attendance as Attendance } };
  }
  if (b.addOrgIds !== undefined) {
    if (!Array.isArray(b.addOrgIds) || b.addOrgIds.length === 0 || !b.addOrgIds.every(isId)) {
      return { ok: false, message: "추가할 단체 정보가 올바르지 않습니다." };
    }
    return { ok: true, change: { kind: "add", orgIds: [...new Set(b.addOrgIds as string[])] } };
  }
  if (b.removeOrgId !== undefined) {
    if (!isId(b.removeOrgId)) return { ok: false, message: "뺄 단체 정보가 올바르지 않습니다." };
    return { ok: true, change: { kind: "remove", orgId: b.removeOrgId } };
  }
  return { ok: false, message: "바꿀 내용이 없습니다." };
}
