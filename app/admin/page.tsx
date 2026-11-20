// 관리자 화면 (PLAN 작업 19번, DESIGN 3.5): 관리자만 열 수 있다.
// 접근 확인 뒤에만 관리자 열쇠로 자료를 읽는다. (신청·신고·가입 대기·수집 결과)
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { dueDateOf, isOverdue, diffPayload } from "../../lib/admin/rules.ts";
import { getCurrentUser } from "../../lib/auth/server.ts";
import { REPORT_REASONS, type ReportReason } from "../../lib/reports/validate.ts";
import { REASON_LABELS } from "../../lib/orgs/reason-labels.ts";
import type { SubmissionPayload } from "../../lib/orgs/submission.ts";
import { createAdminClient } from "../../lib/supabase/admin.ts";
import { AdminPanel, type PendingUserRow, type ReportRow, type RunRow, type SubmissionRow } from "../../features/admin/AdminPanel.tsx";
import { hasQueryError } from "../../lib/db/query.ts";
import { ServiceProblem } from "../../features/nav/ServiceProblem.tsx";
import { AppNav } from "../../features/nav/AppNav.tsx";

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-center text-sm">불러오는 중…</p>}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  if (current.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const [subs, profiles, reports, runs, regions, users] = await Promise.all([
    admin.from("org_submissions").select("id, org_id, submitted_by, payload, created_at").eq("status", "pending").order("created_at"),
    admin.from("profiles").select("user_id, org_name_requested, created_at").eq("role", "org_pending").not("org_name_requested", "is", null).order("created_at"),
    admin.from("org_reports").select("id, org_id, reason, detail, created_at").eq("status", "open").order("created_at"),
    admin.from("collect_runs").select("*").order("started_at", { ascending: false }).limit(10),
    admin.from("regions").select("code, sido, sigungu"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  // 하나라도 읽지 못하면 "대기 중인 신청이 없습니다"처럼 보이지 않게 오류 안내를 보여 준다. (CHECK.md E2)
  if (hasQueryError(subs, profiles, reports, runs, regions, users)) return <ServiceProblem role="admin" />;

  const regionLabel = new Map((regions.data ?? []).map((r) => [r.code as string, `${r.sido} ${r.sigungu}`]));
  const emailOf = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));

  // 신청·신고가 가리키는 단체를 한 번에 읽는다.
  const orgIds = [...new Set([...(subs.data ?? []).map((s) => s.org_id), ...(reports.data ?? []).map((r) => r.org_id)].filter(Boolean))] as string[];
  const orgsResult = orgIds.length ? await admin.from("organizations").select("*").in("id", orgIds) : { data: [] as Record<string, unknown>[] };
  if (hasQueryError(orgsResult)) return <ServiceProblem role="admin" />;
  const orgs = orgsResult.data;
  const orgById = new Map((orgs ?? []).map((o) => [o.id as string, o]));

  const submissionRows: SubmissionRow[] = (subs.data ?? []).map((s) => {
    const payload = s.payload as SubmissionPayload;
    const current = s.org_id ? orgById.get(s.org_id) : null;
    return {
      id: s.id,
      orgName: payload.name,
      submitterEmail: emailOf.get(s.submitted_by) ?? "",
      isNew: !s.org_id,
      submittedAt: s.created_at.slice(0, 10),
      dueDate: dueDateOf(s.created_at),
      overdue: isOverdue(s.created_at),
      changes: diffPayload(current ?? null, payload),
    };
  });

  const userRows: PendingUserRow[] = (profiles.data ?? []).map((p) => ({
    userId: p.user_id,
    email: emailOf.get(p.user_id) ?? "",
    orgNameRequested: p.org_name_requested as string,
    signedUpAt: p.created_at.slice(0, 10),
    dueDate: dueDateOf(p.created_at),
    overdue: isOverdue(p.created_at),
  }));

  const reportRows: ReportRow[] = (reports.data ?? []).map((r) => {
    const org = orgById.get(r.org_id);
    return {
      id: r.id,
      orgName: org?.name ?? "(삭제된 단체)",
      regionLabel: org ? (regionLabel.get(org.region_code) ?? "") : "",
      reasonLabel: REPORT_REASONS[r.reason as ReportReason] ?? r.reason,
      detail: r.detail,
      createdAt: r.created_at.slice(0, 10),
    };
  });

  const runRows: RunRow[] = (runs.data ?? []).map((r) => ({
    id: r.id,
    startedAt: r.started_at.slice(0, 16).replace("T", " "),
    saved: r.saved_count,
    excluded: r.excluded_count,
    reasons: Object.entries((r.excluded_reasons ?? {}) as Record<string, number>)
      .map(([k, n]) => `${REASON_LABELS[k] ?? k} ${n}건`)
      .join(", "),
    note: r.note,
  }));

  return (
    <main className="flex-1 bg-zinc-50 pb-16 text-zinc-900 sm:pb-0 dark:bg-black dark:text-zinc-50">
      <AppNav role="admin" />
      <section className="mx-auto w-full max-w-2xl px-4 py-6">
        <h1 className="text-xl font-bold">관리</h1>
        <AdminPanel submissions={submissionRows} users={userRows} reports={reportRows} runs={runRows} />
      </section>
    </main>
  );
}
