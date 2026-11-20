// 챗봇 화면과 서버가 주고받는 데이터 모양 (PLAN 작업 9번)
import type { FoundOrganization } from "../../lib/search/organizations.ts";

export type ChatRequest = {
  /** 사용자가 입력한 글 (예: "마포구 환경 단체") */
  text?: string;
  /** 후보 중에서 고른 지역 코드. 있으면 text보다 우선한다. */
  regionCode?: string;
  includeNeighbors?: boolean;
  /** 분야 필터 (화면의 분야 칩). 없으면 글 속 분야 낱말을 찾아본다. */
  field?: string;
  offset?: number;
};

export type ChatRegion = { code: string; label: string };

export type ChatResponse =
  | {
      status: "ok";
      region: ChatRegion;
      includeNeighbors: boolean;
      /** 적용 중인 분야 필터 (없으면 null) */
      field: string | null;
      total: number;
      ownTotal: number;
      hasMore: boolean;
      /** 카드 위에 보여 줄 안내 문장 (첫 화면에서만. "더 보기"에는 없다) */
      guide: string | null;
      guideByAi: boolean;
      /** 0곳일 때만: 같은 시·도에서 단체가 있는 다른 시·군·구 */
      suggestions: { code: string; label: string; count: number }[];
      items: (FoundOrganization & { regionLabel: string })[];
    }
  | { status: "ambiguous"; candidates: ChatRegion[]; field: string | null }
  | { status: "none"; message: string }
  | { status: "error"; message: string };
