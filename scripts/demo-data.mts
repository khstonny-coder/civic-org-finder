// 시연용 가상 단체 데이터 넣기/지우기. (실제 단체가 아닙니다)
// 넣기: node --env-file=.env scripts/demo-data.mts
// 지우기: node --env-file=.env scripts/demo-data.mts --remove
// 가상 데이터는 출처 주소가 `https://example.org/demo/` 로 시작하는 것으로 구분한다. (실제 수집 데이터와 섞이지 않고, 이 주소만 골라 지운다)
// 설명 끝에 "(시연용 가상 단체)"를 붙여, 화면에서도 가상임을 알 수 있게 한다.
import { createClient } from "@supabase/supabase-js";
import { normalizeName } from "./collect/names.mts";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const DEMO_PREFIX = "https://example.org/demo/";

if (process.argv.includes("--remove")) {
  const { error, count } = await supabase.from("organizations").delete({ count: "exact" }).like("source_url", `${DEMO_PREFIX}%`);
  if (error) throw error;
  console.log(`시연용 가상 단체 ${count}곳을 지웠습니다.`);
  process.exit(0);
}

// [이름 뒷부분, 분야(수집 때 쓰는 10개 목록), 한 줄 설명]
const POOL: [string, string, string][] = [
  ["푸른숲 환경지킴이", "환경", "동네 하천과 공원을 가꾸고 쓰레기 줄이기 캠페인을 엽니다"],
  ["맑은하늘 기후행동", "환경", "기후위기 교육과 에너지 절약 실천 모임을 운영합니다"],
  ["이웃사랑 돌봄센터", "복지·돌봄", "혼자 사는 어르신 안부 확인과 반찬 나눔을 합니다"],
  ["함께걷는 복지회", "복지·돌봄", "장애인과 가족을 위한 이동 지원과 상담을 합니다"],
  ["꿈나무 배움터", "교육·청소년", "방과 후 학습 도우미와 진로 체험을 지원합니다"],
  ["청소년 마을학교", "교육·청소년", "청소년이 직접 기획하는 마을 프로젝트를 돕습니다"],
  ["마을 예술창작소", "문화·예술", "주민 공연과 전시, 문화 강좌를 엽니다"],
  ["다드림 문화나눔", "문화·예술", "문화 소외 이웃에게 공연 관람 기회를 나눕니다"],
  ["평화인권 연대", "인권·평화", "인권 교육과 평화 문화 행사를 진행합니다"],
  ["사람존중 인권모임", "인권·평화", "차별 없는 지역을 위한 인권 모니터링을 합니다"],
  ["다문화 어울림", "여성·가족·다문화", "이주민 한국어 교실과 가족 상담을 운영합니다"],
  ["맘편한 가족돌봄", "여성·가족·다문화", "공동 육아와 가족 돌봄 품앗이를 지원합니다"],
  ["안심귀갓길 지킴이", "안전·방범", "야간 안심귀갓길 순찰과 안전 점검을 합니다"],
  ["생활안전 시민단", "안전·방범", "어린이 보호구역 점검과 안전 교육을 합니다"],
  ["일자리 디딤돌", "경제·일자리", "중장년 재취업 상담과 직업 교육을 연결합니다"],
  ["골목상권 살리기 모임", "경제·일자리", "동네 가게 협력과 지역 소비 캠페인을 엽니다"],
  ["나눔봉사 연합", "지역사회·자원봉사", "주민 자원봉사자를 모아 지역 행사를 돕습니다"],
  ["이웃손길 봉사단", "지역사회·자원봉사", "집수리와 청소 등 생활 봉사를 합니다"],
  ["우리마을 사랑방", "지역사회·자원봉사", "주민 모임 공간을 열고 마을 의제를 토론합니다"],
  ["시민참여 감시단", "기타", "지역 예산과 정책에 시민이 참여하도록 돕습니다"],
];

// [지역 코드, 이름에 붙일 짧은 지역명]
const REGIONS: [string, string][] = [
  ["11440", "마포"], ["11410", "서대문"], ["11380", "은평"], ["11680", "강남"], ["11560", "영등포"],
  ["41115", "팔달"], ["41117", "영통"], ["41430", "의왕"], ["41135", "분당"],
  ["26350", "해운대"], ["30200", "유성"], ["52111", "완산"],
];
const PER_REGION = 6;

const now = Date.now();
const day = 86_400_000;
const rows = REGIONS.flatMap(([code, short], ri) =>
  Array.from({ length: PER_REGION }, (_, k) => {
    const [suffix, field, desc] = POOL[(ri * 3 + k * 3) % POOL.length];
    const name = `${short} ${suffix}`;
    const n = ri * PER_REGION + k;
    const slug = `${code}-${k + 1}`;
    const url = `${DEMO_PREFIX}${slug}`;
    const withContact = n % 2 === 0;
    return {
      name,
      name_normalized: normalizeName(name),
      region_code: code,
      field,
      description: `${desc} (시연용 가상 단체)`,
      source_url: url,
      // 9곳마다 한 곳은 1년이 넘은 정보로 만들어 "확인 필요" 표시를 보여 준다
      collected_at: new Date(now - (n % 9 === 8 ? 420 : 5 + (n % 70)) * day).toISOString(),
      contact_phone: withContact ? `02-000-${String(1000 + n).slice(-4)}` : null,
      contact_email: withContact ? `info${n + 1}@example.org` : null,
      contact_source_url: withContact ? url : null,
      status: "published",
      needs_review: false,
    };
  }),
);

const { error } = await supabase.from("organizations").upsert(rows, { onConflict: "name_normalized,region_code" });
if (error) throw error;
console.log(`시연용 가상 단체 ${rows.length}곳을 넣었습니다. (지역 ${REGIONS.length}곳 × ${PER_REGION}곳)`);
