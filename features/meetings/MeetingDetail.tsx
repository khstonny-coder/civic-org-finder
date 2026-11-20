"use client";
// 간담회 상세: 초청 단체별 참석 상태 선택, 단체 빼기, 간담회 삭제 (PLAN 작업 16번, DESIGN 3.3)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ATTENDANCE, type Attendance } from "../../lib/meetings/validate.ts";

export type InvitedOrg = {
  orgId: string;
  name: string | null; // 숨김 처리되어 더는 볼 수 없는 단체는 null
  regionLabel: string;
  field: string | null;
  sourceUrl: string | null;
  attendance: Attendance;
};

export function MeetingDetail({ meetingId, orgs }: { meetingId: string; orgs: InvitedOrg[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(orgs);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: unknown): Promise<boolean> {
    setError(null);
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: { ok: boolean; message?: string } = await res.json();
    if (!data.ok) setError(data.message ?? "저장하지 못했습니다.");
    return data.ok;
  }

  async function changeAttendance(orgId: string, attendance: Attendance) {
    if (await patch({ orgId, attendance })) {
      setRows((prev) => prev.map((r) => (r.orgId === orgId ? { ...r, attendance } : r)));
    }
  }

  async function remove(orgId: string) {
    if (await patch({ removeOrgId: orgId })) setRows((prev) => prev.filter((r) => r.orgId !== orgId));
  }

  async function deleteMeeting() {
    if (!window.confirm("이 간담회와 초청·참석 기록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/meetings/${meetingId}`, { method: "DELETE" });
    const data: { ok: boolean; message?: string } = await res.json();
    if (data.ok) {
      router.push("/meetings");
      router.refresh();
    } else {
      setError(data.message ?? "삭제하지 못했습니다.");
    }
  }

  const count = (a: Attendance) => rows.filter((r) => r.attendance === a).length;

  return (
    <div>
      <p className="text-sm">
        초청 {rows.length}곳 · 참석 {count("attending")} · 불참 {count("absent")} · 미정 {count("undecided")}
      </p>
      {error && <p className="mt-2 text-sm text-red-700" role="status">{error}</p>}
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          초청한 단체가 없습니다. 챗봇에서 지역을 검색한 뒤 &quot;이 단체들로 간담회 만들기&quot;로 만들면 단체가 함께 담깁니다.
        </p>
      )}
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((o) => (
          <li key={o.orgId} className="rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <p className="font-semibold break-words">{o.name ?? "(더 이상 공개되지 않는 단체)"}</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {o.regionLabel}
              {o.field ? ` · ${o.field}` : ""}
            </p>
            {o.sourceUrl && (
              <a className="text-xs underline text-zinc-500" href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
                출처 보기
              </a>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                aria-label={`${o.name ?? "단체"} 참석 상태`}
                className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
                value={o.attendance}
                onChange={(e) => changeAttendance(o.orgId, e.target.value as Attendance)}
              >
                {(Object.keys(ATTENDANCE) as Attendance[]).map((a) => (
                  <option key={a} value={a}>
                    {ATTENDANCE[a]}
                  </option>
                ))}
              </select>
              <button className="text-xs underline text-zinc-600 dark:text-zinc-400" onClick={() => remove(o.orgId)}>
                명단에서 빼기
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button className="mt-6 text-sm text-red-700 underline" onClick={deleteMeeting}>
        이 간담회 삭제
      </button>
    </div>
  );
}
