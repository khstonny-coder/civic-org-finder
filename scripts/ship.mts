// 수정 내용을 한 번에 올린다: 비밀 값 검사 → 커밋 → GitHub 푸시 → Vercel 운영 배포 → 접속 확인.
// 실행: node scripts/ship.mts "한국어 한 줄 커밋 메시지"
// - 토큰은 .env에서 읽어 쓰고 화면에 출력하지 않는다. (GITHUB_TOKEN, VERCEL_TOKEN)
// - 커밋 대상 파일에 .env의 비밀 값이나 토큰 모양 문자열이 있으면 멈춘다.
// - Vercel과 GitHub 자동 연결이 안 돼 있어서, 푸시 뒤에 Vercel 명령으로 직접 배포한다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const message = process.argv[2]?.trim();
if (!message) {
  console.error('커밋 메시지(한국어 한 줄)를 넣어 주세요. 예: node scripts/ship.mts "챗봇 안내 문구 수정"');
  process.exit(1);
}

const SITE = "https://civic-org-finder.vercel.app";
const envText = readFileSync(".env", "utf8");
const envPairs = envText
  .split(/\r?\n/)
  .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
  .filter((m): m is RegExpMatchArray => !!m)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")] as const);
const env = (k: string) => envPairs.find(([name]) => name === k)?.[1] ?? "";

const run = (cmd: string, args: string[], opts: { env?: Record<string, string>; quiet?: boolean } = {}) =>
  execFileSync(cmd, args, { encoding: "utf8", env: { ...process.env, ...opts.env } as NodeJS.ProcessEnv, stdio: opts.quiet ? ["ignore", "pipe", "pipe"] : ["ignore", "pipe", "inherit"], shell: process.platform === "win32" && cmd !== "git" }).trim();

// 1) 변경 확인 후 스테이징
run("git", ["add", "-A"]);
const staged = run("git", ["diff", "--cached", "--name-only"]).split("\n").filter(Boolean);
if (staged.length === 0) console.log("새로 커밋할 변경은 없습니다. (푸시·배포는 계속 확인합니다)");

// 2) 비밀 값 검사 (커밋 대상 파일 전체)
const secretValues = envPairs.filter(([, v]) => v.length >= 8);
const tokenShape = /sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sbp_[a-f0-9]{20,}|eyJhbGciOi[A-Za-z0-9._-]{40,}/;
const bad: string[] = [];
for (const f of staged) {
  if (/^\.env($|\.)/.test(f.split("/").pop()!) && f !== ".env.example") bad.push(`${f} (비밀 파일)`);
  let text = "";
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const [k, v] of secretValues) if (text.includes(v)) bad.push(`${f} 안에 ${k} 값`);
  if (tokenShape.test(text)) bad.push(`${f} 에 토큰 모양 문자열`);
}
if (bad.length) {
  run("git", ["reset", "-q"]);
  console.error("⛔ 비밀 값이 들어 있을 수 있어 멈췄습니다 (스테이징은 되돌렸습니다):\n - " + [...new Set(bad)].join("\n - "));
  process.exit(2);
}

// 3) 커밋
if (staged.length) {
  run("git", ["commit", "-q", "-m", `${message}\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`]);
  console.log(`커밋: ${message} (파일 ${staged.length}개)`);
}

// 4) GitHub 푸시 (토큰은 이번 명령에만 쓰고 원격 주소에 저장하지 않는다)
const ghToken = env("GITHUB_TOKEN");
if (!ghToken) throw new Error(".env에 GITHUB_TOKEN이 없습니다.");
const basic = Buffer.from(`x-access-token:${ghToken}`).toString("base64");
run("git", ["-c", `http.extraheader=AUTHORIZATION: basic ${basic}`, "push", "-q", "origin", "main"], { quiet: true });
const ahead = run("git", ["rev-list", "--count", "origin/main..HEAD"]);
console.log(`GitHub 푸시 완료 (올리지 않은 커밋 ${ahead}개)`);

// 5) Vercel 운영 배포
const vToken = env("VERCEL_TOKEN");
if (!vToken) throw new Error(".env에 VERCEL_TOKEN이 없습니다.");
console.log("Vercel 배포 중… (1~2분)");
const out = run("npx", ["--yes", "vercel", "deploy", "--prod", "--yes"], { env: { VERCEL_TOKEN: vToken }, quiet: true });
const url = out.split("\n").find((l) => l.startsWith("https://")) ?? "";
console.log(`Vercel 배포 완료 ${url ? "(" + url + ")" : ""}`);

// 6) 접속 확인
const check = async (path: string) => (await fetch(SITE + path, { redirect: "manual" })).status;
const login = await check("/login");
const html = await (await fetch(SITE + "/login")).text();
const titleOk = html.includes("우리동네 시민단체 찾기");
console.log(`접속 확인: /login ${login}, 제목 ${titleOk ? "보임" : "안 보임"}`);
if (login !== 200 || !titleOk) {
  console.error("⚠️ 배포는 됐지만 접속 확인에 실패했습니다. Vercel 대시보드에서 상태를 확인하세요.");
  process.exit(3);
}
console.log(`✅ 완료: ${SITE}`);
