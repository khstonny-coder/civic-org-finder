// 챗봇 첫 화면. 로그인 정보(쿠키)를 읽으므로 Suspense 안에서 요청 때 그린다. (cacheComponents 규칙)
// 단체 담당자는 챗봇 대신 "내 단체" 화면으로 보낸다. (DESIGN 8.1 역할별 접근)
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { canUseChat } from "../lib/auth/roles.ts";
import { getCurrentUser } from "../lib/auth/server.ts";
import { ChatBox } from "../features/chat/ChatBox.tsx";
import { AccountProblem } from "../features/nav/AccountProblem.tsx";
import { AppNav } from "../features/nav/AppNav.tsx";

export default function Home() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm">불러오는 중…</p>}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  // 역할을 읽지 못하면 /org로 보내지 않고 안내를 보여 준다. (/org도 같은 경우 /로 돌려보내 끝없이 이동하던 문제, CHECK.md E1)
  if (current.role === null) return <AccountProblem />;
  if (!canUseChat(current.role)) redirect("/org");
  return (
    // pb-16: 휴대폰 아래쪽 메뉴에 내용이 가리지 않게 비워 둔다
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role={current.role} />
      <ChatBox canMakeMeeting={current.role === "official"} />
    </main>
  );
}
