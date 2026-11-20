// "확인 필요" 판단 (PLAN 작업 12번, PRD 개발단위 11): 수집일이 1년 넘게 지난 단체, 또는 오류 신고로 표시된 단체.
// DB에 값을 따로 저장하지 않고 검색할 때마다 계산한다. (1년이 지나는 순간 저절로 표시되고, 갱신하면 저절로 사라진다)

export type ReviewReason = "old" | "reported" | null;

/** 수집일로부터 1년이 지났는가 (정확히 1년째 되는 날부터 true) */
export function isStale(collectedAt: string, now: Date = new Date()): boolean {
  const collected = new Date(collectedAt);
  if (Number.isNaN(collected.getTime())) return true; // 날짜를 읽을 수 없으면 확인이 필요한 것으로 본다
  const limit = new Date(collected);
  limit.setUTCFullYear(limit.getUTCFullYear() + 1);
  return now.getTime() >= limit.getTime();
}

/** 확인 필요 이유: 신고로 표시된 것이 먼저, 그다음 오래된 것 */
export function reviewReason(
  org: { collected_at: string; needs_review: boolean },
  now: Date = new Date(),
): ReviewReason {
  if (org.needs_review) return "reported";
  return isStale(org.collected_at, now) ? "old" : null;
}

export const REVIEW_LABELS: Record<Exclude<ReviewReason, null>, string> = {
  old: "수집한 지 1년이 지났습니다",
  reported: "정보가 틀렸다는 신고가 있었습니다",
};
