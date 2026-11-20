// 중복 단체 합치기 (PLAN 작업 6번, DESIGN 4.2, PRD 예외 상황 3번)
// 저장 전 검사를 통과한 단체들 가운데, "정리된 이름 + 시·군·구"가 같은 것을 한 건으로 합친다.
// 같은 단체가 담당부서별로 여러 줄 나오거나, "(사)가평군새마을회"와 "가평군 새마을회"처럼 표기만 다른 경우를 잡는다.
import { classifyField } from "./fields.mts";
import { normalizeName } from "./names.mts";
import type { CheckedOrg } from "./validate.mts";

export type MergedOrg = CheckedOrg & { name_normalized: string };

export type DuplicateGroup = {
  name_normalized: string;
  region_code: string;
  count: number; // 합쳐진 줄 수 (2 이상)
  names: string[]; // 서로 다르게 적혀 있던 이름
};

function longest(values: (string | null)[]): string | null {
  let best: string | null = null;
  for (const v of values) if (v && (!best || v.length > best.length)) best = v;
  return best;
}

/** 같은 단체로 판단된 여러 건에서 가장 정보가 많은 값을 골라 한 건으로 만든다. */
function mergeGroup(group: CheckedOrg[], nameNormalized: string): MergedOrg {
  // 이름: 법인 표기 "(사)" 등이 붙은 더 완전한 표기를 고른다. (길이가 같으면 먼저 나온 것)
  const name = longest(group.map((g) => g.name)) as string;
  // 사업내용: 가장 자세한 것
  const description = longest(group.map((g) => g.description));
  // 연락처: 출처가 있는 연락처가 있는 건 하나를 통째로 고른다. (전화와 이메일의 출처가 섞이지 않게)
  const withContact = group.find((g) => (g.contact_phone || g.contact_email) && g.contact_source_url);
  // 수집일: 가장 최근 것
  const collectedAt = group.map((g) => g.collected_at).sort().at(-1) as string;

  return {
    name,
    name_normalized: nameNormalized,
    region_code: group[0].region_code,
    // 사업내용이 바뀔 수 있어 분야는 합친 뒤 다시 정한다.
    field: classifyField(name, description),
    description,
    source_url: group[0].source_url,
    collected_at: collectedAt,
    contact_phone: withContact?.contact_phone ?? null,
    contact_email: withContact?.contact_email ?? null,
    contact_source_url: withContact?.contact_source_url ?? null,
  };
}

export function mergeDuplicates(orgs: CheckedOrg[]): { merged: MergedOrg[]; duplicates: DuplicateGroup[] } {
  const groups = new Map<string, CheckedOrg[]>();
  for (const org of orgs) {
    const key = `${normalizeName(org.name)}|${org.region_code}`;
    const list = groups.get(key);
    if (list) list.push(org);
    else groups.set(key, [org]);
  }

  const merged: MergedOrg[] = [];
  const duplicates: DuplicateGroup[] = [];
  for (const [key, group] of groups) {
    const [nameNormalized, regionCode] = key.split("|");
    merged.push(mergeGroup(group, nameNormalized));
    if (group.length > 1) {
      duplicates.push({
        name_normalized: nameNormalized,
        region_code: regionCode,
        count: group.length,
        names: [...new Set(group.map((g) => g.name))],
      });
    }
  }
  return { merged, duplicates };
}
