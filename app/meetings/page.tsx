// 내 간담회 목록 (PLAN 작업 16번, DESIGN 3.3). 공무원 본인 것만 보인다.
import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "../../lib/auth/server.ts";
import { createClient } from "../../lib/supabase/server.ts";
import { ServiceProblem } from "../../features/nav/ServiceProblem.tsx";
import { AppNav } from "../../features/nav/AppNav.tsx";
import { NewMeetingForm } from "../../features/meetings/NewMeetingForm.tsx";

// 로그인 정보(쿠키)를 읽는 화면은 Suspense 안에서 요청 때 그린다. (cacheComponents 규칙)
export default function MeetingsPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm">불러오는 중…</p>}>
      <MeetingsContent />
    </Suspense>
  );
}

async function MeetingsContent() {
  const current = await getCurrentUser();
  if (current?.role !== "official") {
    return (
      <main className="flex-1 px-4 py-10 text-center text-sm">
        간담회 관리는 공무원 계정만 이용할 수 있습니다. <Link className="underline" href="/">처음으로</Link>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: meetings, error } = await supabase
    .from("meetings")
    .select("id, title, held_on, purge_after, meeting_orgs(count)")
    .order("held_on", { ascending: false });
  // 읽기에 실패하면 "만든 간담회가 없습니다"가 아니라 오류 안내를 보여 준다. (CHECK.md E2)
  if (error) return <ServiceProblem role="official" />;

  return (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role="official" />
      <section className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold">내 간담회</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">간담회일 90일 뒤 자동으로 삭제됩니다.</p>

        <ul className="mt-4 flex flex-col gap-3">
          {(meetings ?? []).map((m) => (
            <li key={m.id}>
              <Link
                href={`/meetings/${m.id}`}
                className="block rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <p className="font-semibold break-words">{m.title}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {m.held_on} · 초청 {(m.meeting_orgs as { count: number }[])[0]?.count ?? 0}곳 · 삭제 예정 {m.purge_after}
                </p>
              </Link>
            </li>
          ))}
          {(meetings ?? []).length === 0 && <li className="text-sm text-zinc-600 dark:text-zinc-400">아직 만든 간담회가 없습니다.</li>}
        </ul>

        <h2 className="mt-8 mb-2 text-base font-semibold">새 간담회</h2>
        <NewMeetingForm />
      </section>
    </main>
  );
}
