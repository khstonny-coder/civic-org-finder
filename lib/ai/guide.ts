// AI 안내 문장 (PLAN 작업 10번, DESIGN 4.1 [3]): 찾은 단체의 "지역·개수·이름"만 AI에게 주고 한두 문장을 받는다.
// - 단체 목록은 AI가 만들지 않는다. 카드는 항상 DB 결과 그대로이고, AI 문장은 카드 위 안내로만 쓴다.
// - 사용자 글·이메일 같은 개인정보는 AI에 넘기지 않는다. (DESIGN 8번)
// - 호출 횟수를 제한하고, AI가 안 되면(키 없음·장애·한도 초과) 정해진 문장으로 대신한다. (검색은 AI 없이도 동작)
// 키는 .env의 OPENAI_API_KEY에서 읽고 출력하지 않는다.

export type GuideInput = {
  regionLabel: string;
  total: number; // 조건에 맞는 전체 건수
  names: string[]; // 이번에 보여 주는 단체 이름
  includeNeighbors: boolean;
};

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const TIMEOUT_MS = 8000;
const MAX_CALLS_PER_MINUTE = 20; // 서버 전체 기준 호출 제한

// 최근 1분 안의 호출 시각들 (서버 한 대 기준의 간단한 제한)
const recentCalls: number[] = [];
function allowCall(now = Date.now()): boolean {
  while (recentCalls.length > 0 && now - recentCalls[0] > 60_000) recentCalls.shift();
  if (recentCalls.length >= MAX_CALLS_PER_MINUTE) return false;
  recentCalls.push(now);
  return true;
}

/** AI를 쓰지 못할 때 대신 쓰는 문장 */
export function fallbackGuide({ regionLabel, total, includeNeighbors }: GuideInput): string {
  const scope = includeNeighbors ? `${regionLabel}과 인접 지역` : regionLabel;
  return total === 0
    ? `${scope}에서 등록된 시민단체를 찾지 못했습니다.`
    : `${scope}에서 시민단체 ${total}곳을 찾았습니다. 아래 목록과 출처를 확인해 주세요.`;
}

/** AI 문장을 다듬는다: 줄바꿈·과한 길이를 정리하고, 쓸 수 없는 문장이면 null */
export function cleanGuide(raw: string | undefined | null): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (text.length < 5 || text.length > 200) return null;
  if (/https?:\/\//i.test(text)) return null; // 링크는 카드의 출처 링크만 쓴다
  return text;
}

export async function writeGuide(input: GuideInput): Promise<{ text: string; byAi: boolean }> {
  const fallback = { text: fallbackGuide(input), byAi: false };
  const key = process.env.OPENAI_API_KEY;
  // 결과가 0곳이면 AI가 지어낼 여지가 없도록 정해진 문장만 쓴다.
  if (!key || input.total === 0 || !allowCall()) return fallback;

  const system =
    "너는 공무원이 간담회 대상 시민단체를 찾도록 돕는 안내자다. 반드시 한국어 존댓말로 한두 문장만 쓴다. " +
    "주어진 지역·개수·단체 이름 밖의 단체나 사실, 연락처, 링크는 절대 말하지 않는다. 단체를 평가하거나 순위를 매기지 않는다.";
  const user =
    `지역: ${input.regionLabel}${input.includeNeighbors ? " (인접 지역 포함)" : ""}\n` +
    `찾은 단체 수: ${input.total}곳\n` +
    `지금 보여 주는 단체: ${input.names.slice(0, 10).join(", ")}\n` +
    "위 정보만으로 결과를 알리는 안내 문장을 써 줘.";

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 150,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error(`AI 안내 실패: HTTP ${res.status}`);
      return fallback;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = cleanGuide(data.choices?.[0]?.message?.content);
    return text ? { text, byAi: true } : fallback;
  } catch (e) {
    console.error("AI 안내 실패:", e instanceof Error ? e.name : "알 수 없는 오류");
    return fallback;
  }
}
