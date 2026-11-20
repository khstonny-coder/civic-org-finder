"use client";
// 내 단체: 등록·수정 신청 양식과 신청 상태·수정 이력 (PLAN 작업 18번, DESIGN 3.4)
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FIELD_NAMES } from "../../scripts/collect/fields.mts";
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, type SubmissionPayload } from "../../lib/orgs/submission.ts";

export type OrgView = Omit<SubmissionPayload, "field"> & { id: string; field: string; status: string };
export type SubmissionView = {
  id: string;
  payload: Partial<SubmissionPayload>;
  status: "pending" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
};
export type RevisionView = { id: string; changes: Record<string, unknown>; created_at: string };
export type RegionOption = { code: string; sido: string; sigungu: string };

const STATUS_LABEL = { pending: "승인 대기", approved: "승인", rejected: "거절" } as const;
const FIELD_LABEL: Record<string, string> = {
  name: "단체명",
  region_code: "지역",
  field: "분야",
  description: "소개",
  source_url: "출처 URL",
  contact_phone: "대표 전화",
  contact_email: "대표 이메일",
  contact_source_url: "연락처 출처",
};

export function OrgPanel({
  org,
  submissions,
  revisions,
  regions,
}: {
  org: OrgView | null;
  submissions: SubmissionView[];
  revisions: RevisionView[];
  regions: RegionOption[];
}) {
  const router = useRouter();
  // 양식 초기값: 처리 중인 신청이 있으면 그 내용, 없으면 공개 중인 내 단체 정보
  const last = submissions[0]?.payload;
  const init = (key: keyof SubmissionPayload): string => String(last?.[key] ?? org?.[key] ?? "");
  const [form, setForm] = useState({
    name: init("name"),
    region_code: init("region_code"),
    field: init("field") || FIELD_NAMES[0],
    description: init("description"),
    source_url: init("source_url"),
    contact_phone: init("contact_phone"),
    contact_email: init("contact_email"),
    contact_source_url: init("contact_source_url"),
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const hasPending = submissions.some((s) => s.status === "pending");

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data: { ok: boolean; message?: string; notes?: string[] } = await res.json();
      const extra = data.notes?.length ? ` (${data.notes.join(" ")})` : "";
      setMessage({ text: (data.message ?? "처리하지 못했습니다.") + extra, ok: data.ok });
      if (data.ok) router.refresh();
    } catch {
      setMessage({ text: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900";
  const sidos = [...new Set(regions.map((r) => r.sido))];

  return (
    <div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        신청한 내용은 관리자가 확인해 승인하기 전까지 챗봇에 나오지 않습니다. 승인 전에는 지금 공개 중인 정보가 그대로 쓰입니다.
      </p>

      <h2 className="mt-6 text-base font-semibold">지금 공개 중인 정보</h2>
      {org ? (
        <dl className="mt-2 rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
          <dt className="sr-only">단체명</dt>
          <dd className="font-semibold break-words">{org.name}</dd>
          <dd className="text-zinc-600 dark:text-zinc-400">{org.field}</dd>
          {org.description && <dd className="mt-1 break-words">{org.description}</dd>}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">아직 연결된 단체가 없습니다. 아래 양식으로 새 단체 등록을 신청해 주세요.</p>
      )}

      <h2 className="mt-6 text-base font-semibold">{org ? "정보 수정 신청" : "단체 등록 신청"}</h2>
      <form className="mt-2 flex flex-col gap-3" onSubmit={submit}>
        <label className="text-sm">
          단체명
          <input required minLength={2} maxLength={MAX_NAME_LENGTH} className={input} value={form.name} onChange={set("name")} />
        </label>
        <label className="text-sm">
          지역(시·군·구)
          <select required className={input} value={form.region_code} onChange={set("region_code")}>
            <option value="">선택해 주세요</option>
            {sidos.map((sido) => (
              <optgroup key={sido} label={sido}>
                {regions
                  .filter((r) => r.sido === sido)
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.sigungu}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="text-sm">
          분야
          <select className={input} value={form.field} onChange={set("field")}>
            {FIELD_NAMES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          소개 (선택, {MAX_DESCRIPTION_LENGTH}자 이하)
          <textarea rows={3} maxLength={MAX_DESCRIPTION_LENGTH} className={input} value={form.description} onChange={set("description")} />
        </label>
        <label className="text-sm">
          출처 URL (단체 홈페이지나 공개 자료 주소)
          <input required type="url" className={input} value={form.source_url} onChange={set("source_url")} placeholder="https://" />
        </label>
        <fieldset className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
          <legend className="px-1 text-sm">기관 대표 연락처 (선택)</legend>
          <p className="text-xs text-zinc-500">개인 휴대전화·개인 이메일은 적지 마세요. 적어도 저장되지 않습니다. 연락처에는 공개된 출처가 필요합니다.</p>
          <label className="mt-2 block text-sm">
            대표 전화
            <input className={input} value={form.contact_phone} onChange={set("contact_phone")} placeholder="예: 02-123-4567" />
          </label>
          <label className="mt-2 block text-sm">
            대표 이메일
            <input type="email" className={input} value={form.contact_email} onChange={set("contact_email")} />
          </label>
          <label className="mt-2 block text-sm">
            연락처가 공개된 출처 URL
            <input type="url" className={input} value={form.contact_source_url} onChange={set("contact_source_url")} placeholder="https://" />
          </label>
        </fieldset>
        {message && (
          <p className={`text-sm ${message.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700"}`} role="status">
            {message.text}
          </p>
        )}
        <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" disabled={loading || hasPending}>
          {hasPending ? "처리를 기다리는 신청이 있습니다" : "신청하기"}
        </button>
      </form>

      <h2 className="mt-8 text-base font-semibold">내 신청 상태</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {submissions.map((s) => (
          <li key={s.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            <p>
              <span className="font-semibold">{STATUS_LABEL[s.status]}</span> · {s.created_at.slice(0, 10)} · {s.payload.name}
            </p>
            {s.status === "rejected" && s.reject_reason && (
              <p className="mt-1 text-red-700">거절 사유: {s.reject_reason} (고쳐서 다시 신청할 수 있습니다)</p>
            )}
          </li>
        ))}
        {submissions.length === 0 && <li className="text-sm text-zinc-600 dark:text-zinc-400">아직 신청한 내용이 없습니다.</li>}
      </ul>

      <h2 className="mt-8 text-base font-semibold">수정 이력</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {revisions.map((r) => (
          <li key={r.id} className="rounded-lg border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900">
            {r.created_at.slice(0, 10)} · 바뀐 항목: {Object.keys(r.changes).map((k) => FIELD_LABEL[k] ?? k).join(", ") || "-"}
          </li>
        ))}
        {revisions.length === 0 && <li className="text-sm text-zinc-600 dark:text-zinc-400">아직 승인된 수정이 없습니다.</li>}
      </ul>
    </div>
  );
}
