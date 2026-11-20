"use client";
// 관리자 화면 (PLAN 작업 19번, DESIGN 3.5): 신청 승인·거절 / 담당자 본인 확인 / 신고 처리 / 수집 결과
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DIFF_KEYS, REPORT_ACTION_LABELS, type Changes, type ReportAction } from "../../lib/admin/rules.ts";

export type SubmissionRow = {
  id: string;
  orgName: string;
  submitterEmail: string;
  isNew: boolean;
  submittedAt: string;
  dueDate: string;
  overdue: boolean;
  changes: Changes;
};
export type PendingUserRow = { userId: string; email: string; orgNameRequested: string; signedUpAt: string; dueDate: string; overdue: boolean };
export type ReportRow = { id: string; orgName: string; regionLabel: string; reasonLabel: string; detail: string | null; createdAt: string };
export type RunRow = { id: string; startedAt: string; saved: number; excluded: number; reasons: string; note: string | null };

const KEY_LABEL: Record<string, string> = {
  name: "단체명", region_code: "지역 코드", field: "분야", description: "소개", source_url: "출처 URL",
  contact_phone: "대표 전화", contact_email: "대표 이메일", contact_source_url: "연락처 출처",
};

async function call(url: string, method: string, body?: unknown): Promise<{ ok: boolean; message?: string; orgs?: { id: string; name: string; region_code: string; status: string }[] }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return await res.json();
  } catch {
    return { ok: false, message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

const box = "rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900";
const btn = "rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-zinc-600";
const primary = "rounded bg-emerald-700 px-3 py-1 text-sm text-white disabled:opacity-50";

function Due({ date, overdue }: { date: string; overdue: boolean }) {
  return (
    <span className={overdue ? "font-semibold text-red-700" : "text-zinc-600 dark:text-zinc-400"}>
      처리 기한 {date}
      {overdue ? " (지남)" : ""}
    </span>
  );
}

function SubmissionItem({ row }: { row: SubmissionRow }) {
  const router = useRouter();
  const [typeConfirmed, setTypeConfirmed] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const keys = DIFF_KEYS.filter((k) => row.changes[k]);

  async function decide(decision: "approve" | "reject") {
    setBusy(true);
    const r = await call(`/api/admin/submissions/${row.id}`, "PATCH", { decision, typeConfirmed, reason });
    setMessage(r.message ?? null);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <li className={box}>
      <p className="font-semibold break-words">
        {row.orgName} <span className="font-normal text-zinc-600 dark:text-zinc-400">· {row.isNew ? "새 단체 등록" : "정보 수정"}</span>
      </p>
      <p className="text-xs break-words">
        신청자 {row.submitterEmail} · 신청 {row.submittedAt} · <Due date={row.dueDate} overdue={row.overdue} />
      </p>
      <table className="mt-2 w-full table-fixed text-xs">
        <thead>
          <tr className="text-left text-zinc-500">
            <th className="w-20 py-1">항목</th>
            <th>기존</th>
            <th>신청</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k} className="border-t border-zinc-100 align-top dark:border-zinc-800">
              <td className="py-1">{KEY_LABEL[k]}</td>
              <td className="break-words pr-1 text-zinc-500">{row.changes[k]?.from ?? "-"}</td>
              <td className="break-words font-medium">{row.changes[k]?.to ?? "(비움)"}</td>
            </tr>
          ))}
          {keys.length === 0 && (
            <tr>
              <td colSpan={3} className="py-1 text-zinc-500">기존과 달라지는 항목이 없습니다.</td>
            </tr>
          )}
        </tbody>
      </table>
      <label className="mt-3 flex items-start gap-2">
        <input type="checkbox" className="mt-1" checked={typeConfirmed} onChange={(e) => setTypeConfirmed(e.target.checked)} />
        <span>단체 유형 확인: 비영리민간단체·공익적 시민단체이며 협동조합·사회적 기업·종교·친목·노조 단체가 아님을 출처로 확인했습니다.</span>
      </label>
      <label className="mt-2 block text-xs">
        거절 사유 (거절할 때만 필수)
        <input className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="mt-2 flex gap-2">
        <button className={primary} disabled={busy || !typeConfirmed} onClick={() => decide("approve")}>승인</button>
        <button className={btn} disabled={busy || !reason.trim()} onClick={() => decide("reject")}>거절</button>
      </div>
      {message && <p className="mt-2 text-xs" role="status">{message}</p>}
    </li>
  );
}

function UserItem({ row }: { row: PendingUserRow }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; region_code: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function search() {
    const r = await call(`/api/admin/orgs?q=${encodeURIComponent(q)}`, "GET");
    setFound(r.orgs ?? []);
    if (!r.ok) setMessage(r.message ?? null);
  }
  async function approve(orgId: string | null) {
    setBusy(true);
    const r = await call(`/api/admin/users/${row.userId}`, "PATCH", { orgId });
    setMessage(r.message ?? null);
    setBusy(false);
    if (r.ok) router.refresh();
  }

  return (
    <li className={box}>
      <p className="font-semibold break-words">{row.orgNameRequested}</p>
      <p className="text-xs break-words">
        {row.email} · 가입 {row.signedUpAt} · <Due date={row.dueDate} overdue={row.overdue} />
      </p>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        공개된 대표 이메일·공식 홈페이지로 본인 확인을 마친 뒤 승인하세요. 이미 DB에 있는 단체라면 이름으로 찾아 연결하고, 없으면 연결 없이 승인해 담당자가 새 단체 등록을 신청하게 하세요.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
          placeholder="연결할 단체 이름 검색"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className={btn} onClick={search}>검색</button>
      </div>
      {found.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {found.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-2">
              <span className="break-words">{o.name} ({o.region_code}{o.status !== "published" ? `, ${o.status}` : ""})</span>
              <button className={primary} disabled={busy} onClick={() => approve(o.id)}>이 단체로 연결·승인</button>
            </li>
          ))}
        </ul>
      )}
      <button className={`${btn} mt-2`} disabled={busy} onClick={() => approve(null)}>연결 없이 승인 (새 단체 등록용)</button>
      {message && <p className="mt-2 text-xs" role="status">{message}</p>}
    </li>
  );
}

function ReportItem({ row }: { row: ReportRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function act(action: ReportAction) {
    if (action === "hide" && !window.confirm("이 단체를 숨기면 챗봇 검색에 나오지 않습니다. 숨길까요?")) return;
    setBusy(true);
    const r = await call(`/api/admin/reports/${row.id}`, "PATCH", { action });
    setMessage(r.message ?? null);
    setBusy(false);
    if (r.ok) router.refresh();
  }
  return (
    <li className={box}>
      <p className="font-semibold break-words">{row.orgName}</p>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{row.regionLabel} · {row.createdAt}</p>
      <p className="mt-1">사유: {row.reasonLabel}</p>
      {row.detail && <p className="text-xs break-words">설명: {row.detail}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {(Object.keys(REPORT_ACTION_LABELS) as ReportAction[]).map((a) => (
          <button key={a} className={a === "hide" ? btn : btn} disabled={busy} onClick={() => act(a)}>
            {REPORT_ACTION_LABELS[a]}
          </button>
        ))}
      </div>
      {message && <p className="mt-2 text-xs" role="status">{message}</p>}
    </li>
  );
}

export function AdminPanel({
  submissions, users, reports, runs,
}: {
  submissions: SubmissionRow[]; users: PendingUserRow[]; reports: ReportRow[]; runs: RunRow[];
}) {
  const h2 = "mt-8 text-base font-semibold";
  const empty = "mt-2 text-sm text-zinc-600 dark:text-zinc-400";
  return (
    <div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">신청과 담당자 가입은 접수 후 3영업일 안에 처리하는 것을 목표로 합니다.</p>

      <h2 className={h2}>단체 신청 승인 대기 ({submissions.length})</h2>
      <ul className="mt-2 flex flex-col gap-3">{submissions.map((s) => <SubmissionItem key={s.id} row={s} />)}</ul>
      {submissions.length === 0 && <p className={empty}>대기 중인 신청이 없습니다.</p>}

      <h2 className={h2}>단체 담당자 본인 확인 ({users.length})</h2>
      <ul className="mt-2 flex flex-col gap-3">{users.map((u) => <UserItem key={u.userId} row={u} />)}</ul>
      {users.length === 0 && <p className={empty}>확인을 기다리는 담당자가 없습니다.</p>}

      <h2 className={h2}>오류 신고 ({reports.length})</h2>
      <ul className="mt-2 flex flex-col gap-3">{reports.map((r) => <ReportItem key={r.id} row={r} />)}</ul>
      {reports.length === 0 && <p className={empty}>처리할 신고가 없습니다.</p>}

      <h2 className={h2}>수집 결과</h2>
      {runs.length === 0 ? (
        <p className={empty}>아직 수집 기록이 없습니다.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {runs.map((r) => (
            <li key={r.id} className={box}>
              <p>{r.startedAt} · 저장 {r.saved}건 · 제외 {r.excluded}건</p>
              {r.reasons && <p className="text-xs text-zinc-600 dark:text-zinc-400">제외 사유: {r.reasons}</p>}
              {r.note && <p className="text-xs text-zinc-600 dark:text-zinc-400 break-words">{r.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
