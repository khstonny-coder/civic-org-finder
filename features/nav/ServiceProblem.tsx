// 자료를 읽지 못했을 때의 안내 화면 (CHECK.md E2, DESIGN 9번 "AI·DB 서비스 장애")
// DB 오류를 "아직 없습니다"처럼 보여 주면 사용자가 장애를 빈 목록으로 오해한다. 그래서 오류일 때는 이 안내를 보여 준다.
import type { Role } from "../../lib/auth/roles.ts";
import { AppNav } from "./AppNav.tsx";

export function ServiceProblem({ role }: { role: Role | null }) {
  return (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role={role} />
      <section className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-bold">자료를 불러오지 못했습니다</h1>
        <p className="mt-3 text-sm">잠시 후 다시 시도해 주세요. 계속 같은 안내가 나오면 관리자에게 알려 주세요.</p>
      </section>
    </main>
  );
}
