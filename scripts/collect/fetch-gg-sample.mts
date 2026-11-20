// 경기데이터드림 수집 프로그램 (PLAN 작업 4번 + CHECK.md M1)
//   npm run collect:sample  → 인증키 없이 시험용 5건만 받아 data/collected/gg-sample.json에 저장 (PLAN 4번)
//   npm run collect:full    → .env의 GG_OPENAPI_KEY(경기데이터드림 인증키)로 전체를 끝까지 받아 data/collected/gg-full.json에 저장
// "비영리민간단체(전분야) 현황" 공개 API에서 단체 정보를 가져와 우리 서비스의 단체 정보 모양으로 바꾼다.
// - DB에는 넣지 않는다. (저장은 PLAN 7번의 collect:save)
// - 개인정보 보호: 대표자 이름과 주소는 가져온 뒤 바로 버리고 저장하지 않는다. (PRD 7번)
// - 저장 전 검사(필수 항목·단체 유형·개인 연락처)는 `npm run collect:check`가 한다. (PLAN 5번)
// - 인증키 값은 화면에 출력하지 않는다.
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchAllPages, type Page } from "./paginate.mts";
import { matchRegion, regionLabel } from "./regions.mts";

const ENDPOINT = "https://openapi.gg.go.kr/NonprftmkPrvategrp";
const SOURCE_URL =
  "https://data.gg.go.kr/portal/data/service/selectServicePage.do?infId=QZT80FT2H6KK71YGRFLU15263757&infSeq=1";
const SOURCE_LABEL = "경기데이터드림 비영리민간단체(전분야) 현황 (경기도, 데이터 기준일 2025-12-31)";
// 이 서버는 이름 없는 도구(기본 curl 등)의 접속을 막는다. 우리 프로그램의 이름을 밝히고 접속한다.
const USER_AGENT = "my-app-collector/0.1 (civic organization directory)";
const FULL_PAGE_SIZE = 1000; // 한 번에 받는 건수 (이 API의 최대치)
const PAUSE_MS = 400; // 서버에 부담을 주지 않도록 쪽과 쪽 사이에 쉰다
const MAX_ROWS = 20000; // 안전장치: 이보다 많으면 중단하고 알린다

type ApiRow = {
  SIGUN_NM?: string;
  SIGUN_CD?: string;
  GRP_NM?: string;
  REGIST_DE?: string;
  BIZ_CONT?: string;
  REFINE_ROADNM_ADDR?: string;
  REFINE_LOTNO_ADDR?: string;
  // 대표자(REPRSNTV) 등 개인 이름 항목은 일부러 읽지 않는다.
};

type Collected = {
  name: string;
  region_code: string | null;
  region_label: string;
  match_note: string;
  description: string | null;
  registered_on: string | null;
  source_url: string;
  source_label: string;
  collected_at: string;
};

// 20000612 → 2000-06-12
function formatDate(value: string | undefined): string | null {
  return value && /^\d{8}$/.test(value)
    ? `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
    : null;
}

const full = process.argv.includes("--full");
const key = process.env.GG_OPENAPI_KEY?.trim();
if (full && !key) {
  console.log("❌ 전체 수집에는 경기데이터드림 인증키가 필요합니다.");
  console.log("   1) 경기데이터드림에서 이 데이터의 인증키를 신청해 받고");
  console.log("   2) .env 파일에 GG_OPENAPI_KEY=발급받은키 한 줄을 추가한 뒤 다시 실행해 주세요.");
  process.exit(1);
}

type Body = { NonprftmkPrvategrp?: [{ head: unknown[] }, { row?: ApiRow[] }] };
type Head = [{ list_total_count?: number }, { RESULT?: { CODE?: string; MESSAGE?: string } }];

/** 한 쪽을 받아 온다. 실패하면 이유를 알리고 멈춘다. (주소에 든 인증키는 출력하지 않는다) */
async function fetchPage(pageIndex: number, pageSize: number): Promise<Page<ApiRow>> {
  const params = new URLSearchParams({ Type: "json", pIndex: String(pageIndex), pSize: String(pageSize) });
  if (full && key) params.set("KEY", key);
  const response = await fetch(`${ENDPOINT}?${params}`, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`접속 실패: HTTP ${response.status}`);

  let body: Body & { RESULT?: { CODE?: string; MESSAGE?: string } };
  try {
    body = await response.json();
  } catch {
    throw new Error("응답이 JSON이 아닙니다. (접속이 차단되었을 수 있습니다)");
  }
  // 인증키가 틀리거나 한도를 넘으면 목록 대신 RESULT만 오는 경우가 있다.
  if (body.RESULT?.CODE && body.RESULT.CODE !== "INFO-000" && !body.NonprftmkPrvategrp) {
    if (body.RESULT.CODE === "INFO-200") return { rows: [], total: 0 }; // 해당 데이터 없음
    throw new Error(`데이터를 받지 못했습니다: ${body.RESULT.MESSAGE ?? body.RESULT.CODE}`);
  }
  const head = body.NonprftmkPrvategrp?.[0]?.head as Head | undefined;
  const code = head?.[1]?.RESULT?.CODE;
  if (code && code !== "INFO-000") {
    if (code === "INFO-200") return { rows: [], total: 0 };
    throw new Error(`데이터를 받지 못했습니다: ${head?.[1]?.RESULT?.MESSAGE ?? code}`);
  }
  return { rows: body.NonprftmkPrvategrp?.[1]?.row ?? [], total: head?.[0]?.list_total_count ?? 0 };
}

let rows: ApiRow[];
let total: number;
try {
  if (full) {
    console.log("전체 수집을 시작합니다. (쪽마다 잠시 쉬며 받습니다)");
    const result = await fetchAllPages(fetchPage, {
      pageSize: FULL_PAGE_SIZE,
      maxRows: MAX_ROWS,
      pauseMs: PAUSE_MS,
      onPage: (got, all) => console.log(`  ${got} / ${all}건 받음`),
    });
    rows = result.rows;
    total = result.total;
    if (result.truncated) console.log(`⚠️ 안전장치(${MAX_ROWS}건)에서 멈췄습니다. 전체 ${total}건 중 일부만 받았습니다.`);
    if (rows.length < total && !result.truncated) {
      console.log(`⚠️ 서버가 중간에 빈 응답을 보내 ${rows.length}건에서 멈췄습니다. (전체 ${total}건) 잠시 후 다시 실행해 주세요.`);
    }
  } else {
    const page = await fetchPage(1, 5);
    rows = page.rows;
    total = page.total;
  }
} catch (e) {
  console.log(`❌ ${e instanceof Error ? e.message : "수집 중 알 수 없는 오류"}`);
  process.exit(1);
}
if (rows.length === 0) {
  console.log("❌ 받은 데이터가 없습니다.");
  process.exit(1);
}

const collectedAt = new Date().toISOString();
const collected: Collected[] = rows.map((row) => {
  const match = matchRegion({
    sido: "경기도",
    sigunCode: row.SIGUN_CD,
    sigunName: row.SIGUN_NM,
    addresses: [row.REFINE_ROADNM_ADDR, row.REFINE_LOTNO_ADDR],
  });
  return {
    name: (row.GRP_NM ?? "").trim(),
    region_code: match.code,
    region_label: match.code ? regionLabel(match.code) : (row.SIGUN_NM ?? ""),
    match_note: match.note,
    description: row.BIZ_CONT?.trim() || null,
    registered_on: formatDate(row.REGIST_DE),
    source_url: SOURCE_URL,
    source_label: SOURCE_LABEL,
    collected_at: collectedAt,
  };
});

const setName = full ? "gg-full" : "gg-sample";
mkdirSync(new URL("../../data/collected/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../../data/collected/${setName}.json`, import.meta.url), JSON.stringify(collected, null, 2) + "\n");

const unmatched = collected.filter((c) => !c.region_code).length;
console.log(`✅ ${collected.length}건을 가져왔습니다. (전체 ${total}건${full ? "" : " 중 시험용 5건"})`);
if (full) {
  console.log(`   시·군·구를 정하지 못한 건: ${unmatched}건 (검사 단계에서 제외 사유로 기록됩니다)`);
  console.log("   다음: npm run collect:check:full → npm run collect:save:full (또는 한 번에 npm run collect:run:full)");
} else {
  collected.forEach((c, i) => {
    console.log(`\n${i + 1}. ${c.name}`);
    console.log(`   지역: ${c.region_label} [${c.region_code ?? "미확인"}] (${c.match_note})`);
    console.log(`   사업내용: ${c.description ?? "(없음)"}`);
    console.log(`   등록일: ${c.registered_on ?? "(없음)"}`);
  });
}
console.log(`\n저장: data/collected/${setName}.json (대표자 이름·주소는 저장하지 않음)`);
