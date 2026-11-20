// 지역별 단체 검색 (PLAN 작업 8번, DESIGN 4.3 "DB 검색")
// - 소재지가 그 시·군·구인 단체를 먼저 찾는다.
// - 사용자가 요청했을 때만(includeNeighbors) 인접 지역 단체를 그 뒤에 이어 붙인다.
// - 공개(published) 단체만 찾는다. 대기·숨김 단체는 일반 검색에 나오지 않는다.
// - 한 번에 10곳씩 돌려주고, 전체 건수도 알려 줘서 "더 보기"를 만들 수 있게 한다.
// DB 연결(supabase)은 밖에서 받는다: 화면에서는 로그인 사용자 연결, 시험·점검에서는 관리자 연결을 넣는다.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegionRow } from "./regions.ts";
import { reviewReason, type ReviewReason } from "./review.ts";

export const PAGE_SIZE = 10;

export type FoundOrganization = {
  id: string;
  name: string;
  region_code: string;
  field: string;
  description: string | null;
  source_url: string;
  collected_at: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
  needs_review: boolean;
  /** 확인 필요 이유: 신고(reported) / 수집 1년 경과(old) / 없음(null). needs_review는 둘 중 하나면 true */
  review_reason: ReviewReason;
  /** 사용자가 말한 지역이 아니라 인접 지역에서 찾은 단체인가 */
  from_neighbor: boolean;
};

export type SearchOptions = {
  region: RegionRow;
  /** 사용자가 "인접 지역도"라고 요청했을 때만 true */
  includeNeighbors?: boolean;
  /** 분야 필터 (PLAN 20번에서 화면과 연결) */
  field?: string;
  /** 앞에서부터 건너뛸 건수 ("더 보기"용, 기본 0) */
  offset?: number;
  limit?: number;
  /** limit의 위쪽 한계 (기본 10). 엑셀 내려받기에서만 올려 쓴다. */
  maxLimit?: number;
};

export type SearchResult = {
  items: FoundOrganization[];
  total: number; // 조건에 맞는 전체 건수
  own_total: number; // 그중 사용자가 말한 지역의 건수
  has_more: boolean;
};

const COLUMNS =
  "id, name, region_code, field, description, source_url, collected_at, contact_phone, contact_email, contact_source_url, needs_review";

export async function searchOrganizations(supabase: SupabaseClient, options: SearchOptions): Promise<SearchResult> {
  const { region, includeNeighbors = false, field } = options;
  const offset = Math.max(0, options.offset ?? 0);
  // 챗봇은 한 번에 10곳까지(PRD). 엑셀 내려받기만 maxLimit을 키워서 한꺼번에 많이 읽는다.
  const limit = Math.min(options.maxLimit ?? PAGE_SIZE, Math.max(1, options.limit ?? PAGE_SIZE));
  const neighborCodes = includeNeighbors ? region.neighbor_codes : [];

  // 건수를 먼저 센다. (본 지역 / 인접 지역)
  const count = async (codes: string[]): Promise<number> => {
    if (codes.length === 0) return 0;
    let q = supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .in("region_code", codes);
    if (field) q = q.eq("field", field);
    const { count: n, error } = await q;
    if (error) throw new Error(`단체 검색 실패: ${error.message}`);
    return n ?? 0;
  };
  const ownTotal = await count([region.code]);
  const neighborTotal = await count(neighborCodes);
  const total = ownTotal + neighborTotal;

  // 목록은 "본 지역 → 인접 지역" 순서로 이어 붙인 줄에서 [offset, offset+limit) 구간을 꺼낸다.
  const fetchRange = async (codes: string[], from: number, to: number, fromNeighbor: boolean) => {
    if (codes.length === 0 || to < from) return [];
    let q = supabase
      .from("organizations")
      .select(COLUMNS)
      .eq("status", "published")
      .in("region_code", codes)
      .order("name", { ascending: true })
      .order("id", { ascending: true }) // 이름이 같아도 순서가 흔들리지 않게
      .range(from, to);
    if (field) q = q.eq("field", field);
    const { data, error } = await q;
    if (error) throw new Error(`단체 검색 실패: ${error.message}`);
    const now = new Date();
    return (data ?? []).map((row) => {
      const org = row as Omit<FoundOrganization, "from_neighbor" | "review_reason">;
      const reason = reviewReason(org, now);
      // DB의 신고 표시에 "수집 1년 경과"를 더해서 확인 필요 여부를 정한다.
      return { ...org, needs_review: reason !== null, review_reason: reason, from_neighbor: fromNeighbor };
    });
  };

  const end = offset + limit; // 끝 위치(포함하지 않음)
  const items: FoundOrganization[] = [];
  if (offset < ownTotal) {
    items.push(...(await fetchRange([region.code], offset, Math.min(end, ownTotal) - 1, false)));
  }
  if (end > ownTotal && neighborTotal > 0) {
    const from = Math.max(0, offset - ownTotal);
    items.push(...(await fetchRange(neighborCodes, from, end - ownTotal - 1, true)));
  }
  return { items, total, own_total: ownTotal, has_more: end < total };
}
