// 지역 이름 찾기 (PLAN 작업 8번): 사용자가 쓴 글에서 시·군·구를 알아낸다.
// 지역 표(regions)에 있는 정식 이름·약칭·옛 명칭만 기준으로 삼는다. (PLAN 위험 표: 표 밖의 이름은 추측하지 않는다)
// 화면·서버·시험 어디서든 쓰도록 DB 연결 없이 지역 목록을 받아서 계산만 한다.

export type RegionRow = {
  code: string;
  sido: string;
  sigungu: string;
  aliases: string[];
  former_names: string[];
  neighbor_codes: string[];
};

export type RegionResolution =
  | { status: "found"; region: RegionRow }
  | { status: "ambiguous"; candidates: RegionRow[] } // 예: "중구"는 여러 시·도에 있다
  | { status: "none" };

/** 띄어쓰기를 없애 비교하기 쉽게 만든다. */
const squash = (text: string) => text.normalize("NFKC").replace(/\s+/g, "");

/** 한 지역을 가리킬 수 있는 이름들 (정식 이름, 시·도 포함 이름, 약칭, 옛 명칭, 구 이름만) */
function namesOf(region: RegionRow): string[] {
  const names = [
    region.sigungu,
    `${region.sido}${region.sigungu}`,
    ...region.aliases,
    ...region.former_names,
  ];
  // "수원시 장안구" → "장안구" (시 이름 없이 구만 말하는 경우)
  const parts = region.sigungu.split(/\s+/);
  if (parts.length > 1) names.push(parts[parts.length - 1]);
  // 옛 명칭에서 시·도를 뺀 이름: "충청남도 연기군" → "연기군"
  for (const old of region.former_names) {
    const rest = old.trim().split(/\s+/).slice(1).join("");
    if (rest) names.push(rest);
  }
  return [...new Set(names.map(squash).filter((n) => n.length >= 2))];
}

/**
 * 글 속에서 가장 길게 일치하는 지역 이름을 찾는다.
 *  - 긴 이름이 우선이다. ("서울 중구"는 "중구"보다 먼저)
 *  - 같은 길이로 여러 지역이 걸리면 추측하지 않고 후보를 돌려준다.
 *  - 시 이름만 쓴 경우("수원시")는 그 시에 속한 구들을 후보로 돌려준다.
 */
export function resolveRegion(text: string, regions: RegionRow[]): RegionResolution {
  const query = squash(text);
  if (query.length < 2) return { status: "none" };

  let bestLength = 0;
  let best: RegionRow[] = [];
  for (const region of regions) {
    for (const name of namesOf(region)) {
      if (!query.includes(name)) continue;
      if (name.length > bestLength) {
        bestLength = name.length;
        best = [region];
      } else if (name.length === bestLength && !best.includes(region)) {
        best.push(region);
      }
    }
  }
  if (best.length === 1) return { status: "found", region: best[0] };
  if (best.length > 1) return { status: "ambiguous", candidates: best };

  // 시 이름만 쓴 경우: 이름이 "수원시…"로 시작하는 구들
  const prefixed = regions.filter((r) => namesOf(r).some((n) => n.startsWith(query)));
  if (prefixed.length === 1) return { status: "found", region: prefixed[0] };
  if (prefixed.length > 1) return { status: "ambiguous", candidates: prefixed };
  return { status: "none" };
}
