"use client";
// 로그인·가입 화면 (PLAN 작업 13·18번, DESIGN 3.1): 로그인 / 공무원 가입 / 단체 담당자 가입
import { useRouter } from "next/navigation";
import { useState } from "react";

type Tab = "login" | "signup" | "org";

const ENDPOINTS: Record<Tab, string> = {
  login: "/api/auth/login",
  signup: "/api/auth/signup",
  org: "/api/auth/signup-org",
};
const TAB_LABELS: Record<Tab, string> = { login: "로그인", signup: "공무원 가입", org: "단체 담당자 가입" };

export function LoginForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(ENDPOINTS[tab], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, orgName }),
      });
      const data: { ok: boolean; message?: string; role?: string | null } = await res.json();
      if (!data.ok) {
        setMessage({ text: data.message ?? "처리하지 못했습니다.", ok: false });
      } else if (tab === "login") {
        router.replace("/");
        router.refresh(); // 로그인 쿠키가 적용된 상태로 화면을 다시 불러온다
        return;
      } else {
        setMessage({ text: data.message ?? "인증 메일을 보냈습니다.", ok: true });
      }
    } catch {
      setMessage({ text: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  const tabClass = (t: Tab) =>
    `flex-1 border-b-2 px-1 py-2 text-sm ${tab === t ? "border-emerald-700 font-semibold" : "border-transparent text-zinc-500"}`;

  return (
    <section className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="text-xl font-bold">우리동네 시민단체 찾기</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">공무원 또는 시민단체 담당자 계정으로 이용할 수 있습니다.</p>

      <div className="mt-6 flex" role="tablist">
        {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={tabClass(t)}
            onClick={() => {
              setTab(t);
              setMessage(null);
            }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        {tab === "org" && (
          <label className="text-sm">
            신청할 단체명
            <input
              required
              minLength={2}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
            />
          </label>
        )}
        <label className="text-sm">
          이메일
          <input
            type="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={tab === "signup" ? "예: name@korea.kr" : ""}
          />
        </label>
        <label className="text-sm">
          비밀번호
          <input
            type="password"
            required
            minLength={tab !== "login" ? 8 : undefined}
            autoComplete={tab !== "login" ? "new-password" : "current-password"}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {tab === "signup" && (
          <p className="text-xs text-zinc-500">공공기관 이메일(go.kr, korea.kr 등)만 가입할 수 있고, 메일 인증 후 이용할 수 있습니다. 비밀번호는 8자 이상.</p>
        )}
        {tab === "org" && (
          <p className="text-xs text-zinc-500">
            가입 후 메일 인증을 마쳐도 관리자가 본인 확인을 해야 단체 정보를 등록할 수 있습니다. 이메일·비밀번호·단체명 외에는 받지 않습니다.
          </p>
        )}
        <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
          {tab === "login" ? "로그인" : "가입하기"}
        </button>
      </form>

      {message && (
        <p className={`mt-4 text-sm ${message.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700"}`} role="status">
          {message.text}
        </p>
      )}
    </section>
  );
}
