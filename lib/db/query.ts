// 여러 DB 조회 결과 중 하나라도 오류가 났는지 (조회 결과 객체의 error 칸을 본다) — CHECK.md E2
// 화면이 오류를 "없습니다"로 보여 주지 않고 "잠시 후 다시 시도해 주세요" 안내를 보여 주는 데 쓴다.
export function hasQueryError(...results: unknown[]): boolean {
  return results.some((r) => !!(r as { error?: unknown } | null)?.error);
}
