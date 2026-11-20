// 내 단체 화면 (PLAN 작업 18번, DESIGN 3.4): 단체 담당자 전용
// - 승인 대기(org_pending): 관리자 본인 확인을 기다리는 안내만 보인다.
// - 단체(org): 내 단체 정보, 등록·수정 신청 양식, 신청 상태(승인 대기·승인·거절 사유), 수정 이력
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "../../lib/auth/server.ts";
import { createClient } from "../../lib/supabase/server.ts";
import { AccountProblem } from "../../features/nav/AccountProblem.tsx";
import { hasQueryError } from "../../lib/db/query.ts";
import { ServiceProblem } from "../../features/nav/ServiceProblem.tsx";
import { AppNav } from "../../features/nav/AppNav.tsx";
import { OrgPanel, type OrgView, type RegionOption, type RevisionView, type SubmissionView } from "../../features/org/OrgPanel.tsx";

export default function OrgPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm">불러오는 중…</p>}>
      <OrgContent />
    </Suspense>
  );
}

async function OrgContent() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.role === null) return <AccountProblem />; // 역할을 읽지 못한 경우: /로 보내면 서로 끝없이 이동한다 (CHECK.md E1)
  if (current.role !== "org" && current.role !== "org_pending") redirect("/");

  const supabase = await createClient();
  const shell = (body: React.ReactNode) => (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role={current.role} />
      <section className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold">내 단체</h1>
        {body}
      </section>
    </main>
  );

  const profileResult = await supabase
    .from("profiles")
    .select("org_id, org_name_requested")
    .eq("user_id", current.user.id)
    .maybeSingle();
  // 읽기에 실패하면 빈 화면이나 잘못된 안내 대신 오류 안내를 보여 준다. (CHECK.md E2)
  if (hasQueryError(profileResult)) return <ServiceProblem role={current.role} />;
  const profile = profileResult.data;

  if (current.role === "org_pending") {
    return shell(
      <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-700 dark:bg-zinc-900">
        <p className="font-semibold">관리자 확인을 기다리고 있습니다.</p>
        <p className="mt-2">
          신청한 단체: {profile?.org_name_requested ?? "(없음)"}
        </p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          관리자가 공개된 대표 이메일·공식 홈페이지로 본인 확인을 마치면 단체 정보를 등록할 수 있습니다. 보통 3영업일 안에 처리합니다.
        </p>
      </div>,
    );
  }

  const orgResult = profile?.org_id
    ? await supabase.from("organizations").select("*").eq("id", profile.org_id).maybeSingle()
    : { data: null };
  const submissionsResult = await supabase
    .from("org_submissions")
    .select("id, payload, status, reject_reason, created_at")
    .eq("submitted_by", current.user.id)
    .order("created_at", { ascending: false });
  const revisionsResult = profile?.org_id
    ? await supabase.from("org_revisions").select("id, changes, created_at").eq("org_id", profile.org_id).order("created_at", { ascending: false })
    : { data: [] };
  const regionsResult = await supabase.from("regions").select("code, sido, sigungu").order("code");
  if (hasQueryError(orgResult, submissionsResult, revisionsResult, regionsResult)) return <ServiceProblem role={current.role} />;
  const org = orgResult.data;
  const submissions = submissionsResult.data;
  const revisions = revisionsResult.data;
  const regions = regionsResult.data;

  return shell(
    <OrgPanel
      org={(org as OrgView | null) ?? null}
      submissions={(submissions ?? []) as SubmissionView[]}
      revisions={(revisions ?? []) as RevisionView[]}
      regions={(regions ?? []) as RegionOption[]}
    />,
  );
}
