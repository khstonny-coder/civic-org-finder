// 간담회 상세 (PLAN 작업 16번, DESIGN 3.3). 내 간담회가 아니면 보이지 않는다. (DB 접근 규칙)
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "../../../lib/auth/server.ts";
import { createClient } from "../../../lib/supabase/server.ts";
import { hasQueryError } from "../../../lib/db/query.ts";
import { ServiceProblem } from "../../../features/nav/ServiceProblem.tsx";
import { AppNav } from "../../../features/nav/AppNav.tsx";
import { MeetingDetail, type InvitedOrg } from "../../../features/meetings/MeetingDetail.tsx";
import type { Attendance } from "../../../lib/meetings/validate.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 로그인 정보(쿠키)와 주소의 id를 읽는 화면은 Suspense 안에서 요청 때 그린다. (cacheComponents 규칙)
export default function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm">불러오는 중…</p>}>
      <MeetingContent params={params} />
    </Suspense>
  );
}

async function MeetingContent({ params }: { params: PageProps<"/meetings/[id]">["params"] }) {
  const { id } = await params;
  const current = await getCurrentUser();
  if (current?.role !== "official") notFound();
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const meetingResult = await supabase
    .from("meetings")
    .select("id, title, held_on, purge_after")
    .eq("id", id)
    .maybeSingle();
  // 읽기 오류와 "없는 간담회"를 구분한다. 오류면 안내를 보여 주고, 정말 없을 때만 찾을 수 없음으로 처리한다. (CHECK.md E2)
  if (hasQueryError(meetingResult)) return <ServiceProblem role="official" />;
  const meeting = meetingResult.data;
  if (!meeting) notFound();

  const invitedResult = await supabase.from("meeting_orgs").select("org_id, attendance").eq("meeting_id", id);
  const invited = invitedResult.data;
  const orgIds = (invited ?? []).map((i) => i.org_id as string);
  const orgsResult = orgIds.length
    ? await supabase.from("organizations").select("id, name, field, source_url, region_code").in("id", orgIds)
    : { data: [] as { id: string; name: string; field: string; source_url: string; region_code: string }[] };
  const orgs = orgsResult.data;
  const regionsResult = await supabase.from("regions").select("code, sido, sigungu");
  const regions = regionsResult.data;
  if (hasQueryError(invitedResult, orgsResult, regionsResult)) return <ServiceProblem role="official" />;
  const regionName = new Map((regions ?? []).map((r) => [r.code as string, `${r.sido} ${r.sigungu}`]));
  const orgById = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  const rows: InvitedOrg[] = (invited ?? []).map((i) => {
    const o = orgById.get(i.org_id as string);
    return {
      orgId: i.org_id as string,
      name: o?.name ?? null,
      regionLabel: o ? (regionName.get(o.region_code as string) ?? "") : "",
      field: o?.field ?? null,
      sourceUrl: o?.source_url ?? null,
      attendance: i.attendance as Attendance,
    };
  });

  return (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role="official" />
      <section className="mx-auto w-full max-w-2xl px-4 py-6">
        <Link className="text-sm underline" href="/meetings">
          ← 내 간담회
        </Link>
        <h1 className="mt-2 text-xl font-bold break-words">{meeting.title}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {meeting.held_on} · {meeting.purge_after}에 자동 삭제됩니다 (간담회일 90일 뒤)
        </p>
        <div className="mt-4">
          <MeetingDetail meetingId={meeting.id as string} orgs={rows} />
        </div>
      </section>
    </main>
  );
}
