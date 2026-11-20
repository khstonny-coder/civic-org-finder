// 0곳일 때의 제안 (PLAN 작업 11번, PRD 예외 1): 같은 시·도 안에서 단체가 실제로 있는 다른 시·군·구를 알려 준다.
// 단체가 없는 지역은 제안하지 않는다. (눌렀는데 또 0곳인 막다른 길을 만들지 않기 위해)
import type { RegionRow } from "./regions.ts";

// 분야 필터가 걸려 있으면 호출하는 쪽에서 그 분야의 단체만 넘기면 된다. (이 파일은 지역 코드만 센다)
export type RegionSuggestion = { code: string; label: string; count: number };

/** 같은 시·도의 시·군·구 코드들 (자기 자신 제외) */
export function sameSidoCodes(region: RegionRow, regions: RegionRow[]): string[] {
  return regions.filter((r) => r.sido === region.sido && r.code !== region.code).map((r) => r.code);
}

/**
 * 공개 단체가 있는 지역 코드 목록(단체 한 건당 한 줄)을 받아, 단체가 많은 지역부터 최대 limit곳을 제안한다.
 * 건수가 같으면 지역 이름 순.
 */
export function pickSuggestions(
  region: RegionRow,
  regions: RegionRow[],
  orgRegionCodes: string[],
  limit = 8,
): RegionSuggestion[] {
  const allowed = new Set(sameSidoCodes(region, regions));
  const counts = new Map<string, number>();
  for (const code of orgRegionCodes) if (allowed.has(code)) counts.set(code, (counts.get(code) ?? 0) + 1);

  const byCode = new Map(regions.map((r) => [r.code, r]));
  return [...counts.entries()]
    .map(([code, count]) => {
      const r = byCode.get(code) as RegionRow;
      return { code, label: `${r.sido} ${r.sigungu}`, count };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ko"))
    .slice(0, limit);
}
