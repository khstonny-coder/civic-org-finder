// 지역 목록을 DB(regions 표)에 넣는 프로그램: `npm run regions:load`
// data/regions.json의 시·군·구 256곳을 DB에 넣는다. 이미 있으면 같은 코드의 내용을 덮어쓴다(여러 번 실행해도 안전).
// 비밀 값은 출력하지 않는다.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

type Region = {
  code: string;
  sido: string;
  sigungu: string;
  aliases: string[];
  former_names: string[];
  neighbor_codes: string[];
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log("❌ .env에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 값이 필요합니다.");
  process.exit(1);
}

const regions: Region[] = JSON.parse(
  readFileSync(new URL("../data/regions.json", import.meta.url), "utf8"),
);

// 넣기 전에 데이터가 올바른지 먼저 확인한다.
const codes = new Set(regions.map((r) => r.code));
const problems: string[] = [];
if (codes.size !== regions.length) problems.push("코드가 중복됩니다.");
for (const r of regions) {
  if (!/^\d{5}$/.test(r.code)) problems.push(`${r.code}: 코드는 숫자 5자리여야 합니다.`);
  for (const n of r.neighbor_codes) {
    if (!codes.has(n)) problems.push(`${r.code}: 없는 인접 코드 ${n}`);
  }
}
if (problems.length > 0) {
  console.log("❌ 지역 데이터에 문제가 있어 넣지 않았습니다.");
  problems.forEach((p) => console.log("   - " + p));
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 100곳씩 나누어 넣는다.
for (let i = 0; i < regions.length; i += 100) {
  const chunk = regions.slice(i, i + 100);
  const { error } = await supabase.from("regions").upsert(chunk, { onConflict: "code" });
  if (error) {
    console.log(`❌ ${i + 1}번째부터 넣는 중 오류: ${error.message}`);
    process.exit(1);
  }
}

const { count, error } = await supabase
  .from("regions")
  .select("*", { count: "exact", head: true });
if (error) {
  console.log(`❌ 확인 중 오류: ${error.message}`);
  process.exit(1);
}
console.log(`✅ regions 표에 ${count}곳이 들어 있습니다. (넣은 데이터: ${regions.length}곳)`);
