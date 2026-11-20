// 페이지 나눠 받기 (CHECK.md M1): 한 번에 다 못 주는 공개 API를 1쪽부터 끝까지 차례로 받아 이어 붙인다.
// 네트워크와 분리해 두어, 가짜 응답으로 시험할 수 있다.

export type Page<T> = { rows: T[]; total: number };

export async function fetchAllPages<T>(
  fetchPage: (pageIndex: number, pageSize: number) => Promise<Page<T>>,
  options: { pageSize: number; maxRows?: number; pauseMs?: number; onPage?: (got: number, total: number) => void },
): Promise<{ rows: T[]; total: number; truncated: boolean }> {
  const { pageSize, maxRows = Infinity, pauseMs = 0, onPage } = options;
  const rows: T[] = [];
  let total = Infinity;
  for (let index = 1; rows.length < total && rows.length < maxRows; index++) {
    const page = await fetchPage(index, pageSize);
    total = page.total;
    // 서버가 빈 쪽을 주면 더 받을 것이 없다고 보고 멈춘다. (끝없이 되풀이하지 않게)
    if (page.rows.length === 0) break;
    rows.push(...page.rows);
    onPage?.(Math.min(rows.length, total), total);
    if (rows.length < total && pauseMs > 0) await new Promise((r) => setTimeout(r, pauseMs));
  }
  const finalTotal = Number.isFinite(total) ? total : rows.length;
  return { rows: rows.slice(0, maxRows), total: finalTotal, truncated: rows.length > maxRows || (rows.length >= maxRows && maxRows < finalTotal) };
}
