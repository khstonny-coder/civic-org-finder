// DB 연결 확인 프로그램: `npm run db:check`
// .env의 값으로 Supabase에 접속해서, 필요한 표 10개가 모두 만들어져 있는지 확인한다.
// 비밀 값은 화면에 절대 출력하지 않는다. (변수 "이름"과 결과만 출력)
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "regions",
  "organizations",
  "profiles",
  "org_revisions",
  "org_submissions",
  "org_reports",
  "meetings",
  "meeting_orgs",
  "chat_logs",
  "collect_runs",
];

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.log("❌ .env에 아래 값이 없습니다. (값은 Supabase 프로젝트를 만든 뒤 채웁니다)");
  for (const name of missing) console.log(`   - ${name}`);
  console.log("   Supabase 프로젝트를 만들고 위 이름으로 .env에 값을 넣은 뒤 다시 실행하세요.");
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

let failed = 0;
for (const table of TABLES) {
  // head: true → 내용은 가져오지 않고 "표가 있는지, 몇 건인지"만 확인한다.
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) {
    failed += 1;
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    console.log(`✅ ${table}: 연결됨 (${count ?? 0}건)`);
  }
}

if (failed > 0) {
  console.log(`\n표 ${failed}개를 찾지 못했습니다. 마이그레이션(supabase db push)을 먼저 실행했는지 확인하세요.`);
  process.exit(1);
}
console.log("\n✅ DB 연결과 표 10개를 모두 확인했습니다.");
