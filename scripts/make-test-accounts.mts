// 시험용 계정 만들기: 공무원·단체 담당자·관리자 3개. (직접 화면을 눌러 볼 때 쓴다)
// 실행: node --env-file=.env scripts/make-test-accounts.mts
// 비밀번호는 무작위로 만들어 `.env.test-accounts`에만 적는다. (.env* 는 .gitignore에 들어 있어 커밋되지 않는다)
// 비밀번호를 직접 정하려면 `.env.test-accounts` 의 세 번째 칸을 고친 뒤 `--from-file` 을 붙여 실행한다.
// 이미 있는 계정이면 비밀번호만 새로 바꾼다. 시험이 끝나면 `scripts/make-test-accounts.mts --remove`로 지운다.
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const accounts = [
  { role: "official", email: "test-official@test.go.kr" },
  { role: "org", email: "test-org@test.example.com" },
  { role: "admin", email: "test-admin@test.example.com" },
] as const;

const list = await admin.auth.admin.listUsers({ perPage: 200 });
const find = (email: string) => list.data.users.find((u) => u.email === email);

if (process.argv.includes("--remove")) {
  for (const a of accounts) {
    const u = find(a.email);
    if (u) await admin.auth.admin.deleteUser(u.id);
  }
  console.log("시험 계정을 지웠습니다.");
  process.exit(0);
}

// --from-file: .env.test-accounts 에 직접 적어 둔 비밀번호를 그대로 적용한다. (형식: `역할 아이디 비밀번호`, 한 줄에 하나)
const fromFile = process.argv.includes("--from-file");
const wanted = new Map<string, string>();
if (fromFile) {
  for (const line of readFileSync(".env.test-accounts", "utf8").split(/\r?\n/)) {
    const [role, , pw] = line.trim().split(/\s+/);
    if (role && pw) wanted.set(role, pw);
  }
}

const lines: string[] = [];
for (const a of accounts) {
  const password = fromFile ? wanted.get(a.role) : randomBytes(9).toString("base64url");
  if (!password || password.length < 8) throw new Error(`${a.role} 비밀번호가 없거나 8자보다 짧습니다. .env.test-accounts 를 확인하세요.`);
  const meta = a.role === "org" ? { org_name: "시험 단체" } : {};
  let user = find(a.email);
  if (user) {
    await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email: a.email, password, email_confirm: true, user_metadata: meta });
    if (error) throw error;
    user = data.user;
  }
  // 공무원은 로그인할 때 이메일 도메인(go.kr)으로 자동 부여되므로 단체·관리자만 역할을 직접 정한다.
  if (a.role !== "official") await admin.from("profiles").update({ role: a.role }).eq("user_id", user.id);
  lines.push(`${a.role}  ${a.email}  ${password}`);
}
writeFileSync(".env.test-accounts", lines.join("\n") + "\n");
console.log("만들었습니다. 아이디·비밀번호는 .env.test-accounts 파일에 있습니다.");
