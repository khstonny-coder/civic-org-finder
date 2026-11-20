// 분야 필터 (PLAN 작업 20번, DESIGN 3.2): 화면의 분야 칩, 또는 질문 속 분야 낱말("마포구 환경 단체")에서 분야를 정한다.
// 분야는 수집·신청 때 쓰는 10개 목록(scripts/collect/fields.mts)만 인정한다. 목록에 없는 값은 무시한다.
import { FIELD_NAMES, type FieldName } from "../../scripts/collect/fields.mts";

export { FIELD_NAMES };
export type { FieldName };

/** 목록에 있는 분야 이름이면 그대로, 아니면 null */
export function validField(value: unknown): FieldName | null {
  return typeof value === "string" && (FIELD_NAMES as readonly string[]).includes(value) ? (value as FieldName) : null;
}

// 질문 속에서 분야를 알아차리는 낱말. 헷갈리기 쉬운 말은 넣지 않았다. ("기타"는 낱말로 찾지 않는다)
const FIELD_WORDS: Record<Exclude<FieldName, "기타">, string[]> = {
  환경: ["환경"],
  "복지·돌봄": ["복지", "돌봄"],
  "교육·청소년": ["교육", "청소년"],
  "문화·예술": ["문화", "예술"],
  "인권·평화": ["인권", "평화"],
  "여성·가족·다문화": ["여성", "가족", "다문화"],
  "안전·방범": ["안전", "방범"],
  "경제·일자리": ["경제", "일자리"],
  "지역사회·자원봉사": ["자원봉사", "봉사", "지역사회"],
};

/** 글 속에서 분야가 딱 하나로 읽히면 그 분야를, 없거나 여러 분야가 섞이면 null (추측하지 않는다) */
export function detectField(text: string): FieldName | null {
  const squashed = text.replace(/\s+/g, "");
  const hits = (Object.keys(FIELD_WORDS) as (keyof typeof FIELD_WORDS)[]).filter((f) =>
    FIELD_WORDS[f].some((w) => squashed.includes(w)),
  );
  return hits.length === 1 ? hits[0] : null;
}
