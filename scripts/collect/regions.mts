// 수집 프로그램이 함께 쓰는 지역 도구: 지역 표(data/regions.json)를 읽고, 수집한 시군 정보를 시·군·구와 연결한다.
import { readFileSync } from "node:fs";

export type Region = {
  code: string;
  sido: string;
  sigungu: string;
  aliases: string[];
  former_names: string[];
  neighbor_codes: string[];
};

export const regions: Region[] = JSON.parse(
  readFileSync(new URL("../../data/regions.json", import.meta.url), "utf8"),
);

export function findRegion(code: string | null | undefined): Region | undefined {
  return code ? regions.find((r) => r.code === code) : undefined;
}

export function regionLabel(code: string | null | undefined): string {
  const r = findRegion(code);
  return r ? `${r.sido} ${r.sigungu}` : "";
}

type MatchInput = {
  sido: string; // 예: 경기도
  sigunCode?: string; // 자료가 준 시군 코드
  sigunName?: string; // 자료가 준 시군 이름
  addresses?: (string | undefined)[]; // 구를 찾는 데만 쓰는 주소 (저장하지 않는다)
};

/**
 * 수집한 시군 정보를 우리 지역 표의 시·군·구 하나로 연결한다.
 * 1) 코드가 같으면 그 지역  2) 구가 없는 시·군은 이름으로  3) 구가 있는 시는 주소에 적힌 구로 정한다.
 */
export function matchRegion(input: MatchInput): { code: string | null; note: string } {
  const byCode = regions.find((r) => r.code === input.sigunCode);
  if (byCode) return { code: byCode.code, note: "시군 코드 일치" };

  const name = input.sigunName;
  if (!name) return { code: null, note: "시군 정보 없음" };

  const candidates = regions.filter(
    (r) => r.sido === input.sido && r.sigungu.replace(" ", "").startsWith(name),
  );
  if (candidates.length === 1) return { code: candidates[0].code, note: "시군 이름 일치" };
  if (candidates.length === 0) return { code: null, note: "지역 표에 없는 시군" };

  const address = (input.addresses ?? []).filter(Boolean).join(" ").replace(/\s/g, "");
  const byAddress = candidates.filter((r) => address.includes(r.sigungu.replace(" ", "")));
  if (byAddress.length === 1) return { code: byAddress[0].code, note: "주소의 구로 확인" };
  return { code: null, note: `구를 정하지 못함 (후보 ${candidates.length}곳)` };
}
