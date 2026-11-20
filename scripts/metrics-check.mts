// 중간 점검 프로그램 (PLAN 작업 14번, PRD 3번 목표 숫자): `npm run metrics:check`
// 1) 출처 비율: 답변 기록(chat_logs)에 나온 모든 단체 중 올바른 출처 링크가 있는 비율 (목표 100%) — 자동 계산
// 2) 정확도 표본: 답변된 단체에서 무작위로 최대 20곳을 뽑아 확인표(data/review/accuracy-sample.md)를 만든다.
//    "실존·지역·공개 연락처가 모두 맞는지"는 사람이 출처 링크를 열어 대조해야 하므로 프로그램이 판정하지 않는다. (목표 90% 이상)
// DB에는 아무것도 쓰지 않는다. .env 값은 출력하지 않는다.
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SAMPLE_SIZE = 20;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log("❌ .env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const isHttp = (v: string | null | undefined) => {
  try {
    const u = new URL(v ?? "");
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

const logs = await supabase.from("chat_logs").select("org_ids");
const orgs = await supabase
  .from("organizations")
  .select("id, name, region_code, source_url, collected_at, contact_phone, contact_email, contact_source_url");
if (logs.error || orgs.error || !logs.data || !orgs.data) {
  console.log(`❌ 읽지 못했습니다: ${logs.error?.message ?? orgs.error?.message}`);
  process.exit(1);
}
const regions = await supabase.from("regions").select("code, sido, sigungu");
const regionName = new Map((regions.data ?? []).map((r) => [r.code, `${r.sido} ${r.sigungu}`]));
const byId = new Map(orgs.data.map((o) => [o.id as string, o]));

// 1) 출처 비율
const answered = logs.data.flatMap((l) => l.org_ids as string[]);
const withSource = answered.filter((id) => isHttp(byId.get(id)?.source_url)).length;
console.log(`답변 기록 ${logs.data.length}건 / 답변에 나온 단체 ${answered.length}곳 (중복 포함)`);
if (answered.length === 0) {
  console.log("출처 비율: 계산할 답변이 아직 없습니다. 챗봇으로 여러 지역을 검색한 뒤 다시 실행해 주세요.");
} else {
  const rate = (withSource / answered.length) * 100;
  console.log(`출처 링크 비율: ${withSource}/${answered.length} = ${rate.toFixed(1)}% (목표 100%) ${rate === 100 ? "✅" : "❌"}`);
}

// 2) 정확도 표본 (서로 다른 단체 중 무작위)
const distinct = [...new Set(answered)].filter((id) => byId.has(id));
for (let i = distinct.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [distinct[i], distinct[j]] = [distinct[j], distinct[i]];
}
const sample = distinct.slice(0, SAMPLE_SIZE);
console.log(`정확도 표본: 답변된 서로 다른 단체 ${distinct.length}곳 중 ${sample.length}곳을 뽑았습니다. (필요 ${SAMPLE_SIZE}곳)`);
if (sample.length < SAMPLE_SIZE) {
  console.log(`⚠️ 표본이 ${SAMPLE_SIZE}곳보다 적어 90% 판정은 아직 의미가 없습니다. 단체를 더 수집하고 검색 기록을 쌓은 뒤 다시 실행해 주세요.`);
}

const lines = [
  "# 정확도 확인표 (PLAN 14번)",
  "",
  `만든 시각: ${new Date().toISOString().slice(0, 10)} / 표본 ${sample.length}곳`,
  "",
  "각 단체의 **출처 링크를 열어** 세 가지를 확인하고 O/X로 적습니다. 세 가지가 모두 O여야 정답입니다.",
  "- 실존: 출처에서 그 단체가 실제로 확인되는가",
  "- 지역: 아래 지역(시·군·구)이 출처의 소재지와 맞는가",
  "- 연락처: 공개 대표 연락처가 있다면 출처와 같은가 (연락처가 없으면 O로 적습니다)",
  "",
  "| # | 단체명 | 지역 | 대표 연락처 | 출처 | 실존 | 지역 | 연락처 | 정답 |",
  "|---|---|---|---|---|---|---|---|---|",
  ...sample.map((id, i) => {
    const o = byId.get(id)!;
    const contact = [o.contact_phone, o.contact_email].filter(Boolean).join(" / ") || "(없음)";
    return `| ${i + 1} | ${o.name} | ${regionName.get(o.region_code) ?? o.region_code} | ${contact} | ${o.source_url} |  |  |  |  |`;
  }),
  "",
  "정확도 = 정답 수 ÷ 표본 수 (목표 90% 이상)",
  "",
];
mkdirSync(new URL("../data/review/", import.meta.url), { recursive: true });
writeFileSync(new URL("../data/review/accuracy-sample.md", import.meta.url), lines.join("\n"));
console.log("확인표: data/review/accuracy-sample.md");
