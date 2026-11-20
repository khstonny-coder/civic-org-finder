// 계정 정보를 읽지 못했을 때의 안내 화면 (CHECK.md E1)
// 역할(프로필)이 없거나 읽기에 실패하면, 역할에 따라 화면을 옮겨 주는 코드가 서로를 가리키며 끝없이 이동하게 된다.
// 이동시키지 않고 이 안내만 보여 주고, 로그아웃(메뉴)으로 빠져나갈 수 있게 한다.
import { AppNav } from "./AppNav.tsx";

export function AccountProblem() {
  return (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role={null} />
      <section className="mx-auto w-full max-w-2xl px-4 py-10">
        <h1 className="text-xl font-bold">계정 정보를 불러오지 못했습니다</h1>
        <p className="mt-3 text-sm">
          잠시 후 화면을 새로 고쳐 다시 시도해 주세요. 계속 같은 안내가 나오면 로그아웃했다가 다시 로그인하거나, 관리자에게 문의해 주세요.
        </p>
      </section>
    </main>
  );
}
