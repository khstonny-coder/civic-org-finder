"use client";
// 메뉴 (PLAN 작업 17·18번, DESIGN 3번 공통): 넓은 화면에서는 위쪽 검정 바, 휴대폰(sm 미만)에서는 아래쪽 탭으로 보인다.
// 역할에 따라 메뉴가 다르다: 공무원(챗봇·내 간담회) / 단체 담당자(내 단체) / 관리자(챗봇·관리).
// 디자인만 CNN 느낌(검정 바 + 빨강 로고 + 굵은 글씨)으로 바꿨고, 메뉴 구성과 동작은 그대로다.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "../../lib/auth/roles.ts";

type Item = { href: string; label: string };

function itemsFor(role: Role | null): Item[] {
  if (role === "official") {
    return [
      { href: "/", label: "챗봇" },
      { href: "/meetings", label: "내 간담회" },
    ];
  }
  if (role === "org" || role === "org_pending") return [{ href: "/org", label: "내 단체" }];
  if (role === "admin") {
    return [
      { href: "/", label: "챗봇" },
      { href: "/admin", label: "관리" },
    ];
  }
  return [];
}

export function AppNav({ role }: { role: Role | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = itemsFor(role);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const itemClass = (active: boolean) =>
    active ? "font-extrabold text-white border-b-2 border-red-600" : "font-bold text-zinc-300";

  return (
    <>
      {/* 넓은 화면: 위쪽 검정 바 (왼쪽 빨간 로고 블록, 오른쪽 메뉴) */}
      <div className="hidden w-full bg-black text-white sm:block">
        <nav aria-label="메뉴" className="mx-auto flex w-full max-w-2xl items-stretch justify-between gap-4 px-4 text-sm">
          <span className="flex items-center bg-[#cc0000] px-3 py-3 text-base font-black tracking-tight">시민단체</span>
          <div className="flex items-center gap-5">
            {items.map((i) => (
              <Link key={i.href} href={i.href} className={`py-3 hover:text-white ${itemClass(isActive(i.href))}`}>
                {i.label}
              </Link>
            ))}
            <button onClick={logout} className="py-3 font-bold text-zinc-300 hover:text-white">
              로그아웃
            </button>
          </div>
        </nav>
      </div>

      {/* 휴대폰: 아래쪽 고정 탭 (한 손으로 누르기 쉽도록 큰 터치 영역) */}
      <nav
        aria-label="메뉴"
        style={{ gridTemplateColumns: `repeat(${items.length + 1}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-10 grid border-t-2 border-[#cc0000] bg-black pb-[env(safe-area-inset-bottom)] text-sm sm:hidden"
      >
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-h-12 items-center justify-center hover:text-white ${itemClass(isActive(i.href))}`}
          >
            {i.label}
          </Link>
        ))}
        <button onClick={logout} className="flex min-h-12 items-center justify-center font-bold text-zinc-300 hover:text-white">
          로그아웃
        </button>
      </nav>
    </>
  );
}
