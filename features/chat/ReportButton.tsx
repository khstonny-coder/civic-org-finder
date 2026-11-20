"use client";
// "정보가 틀렸어요" 신고 버튼 (PLAN 작업 15번, DESIGN 3.2)
import { useState } from "react";
import { MAX_DETAIL_LENGTH, REPORT_REASONS, type ReportReason } from "../../lib/reports/validate.ts";

export function ReportButton({ orgId, onReported }: { orgId: string; onReported: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | "">("");
  const [detail, setDetail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, reason, detail }),
      });
      const data: { ok: boolean; message?: string } = await res.json();
      setMessage({ text: data.message ?? "처리하지 못했습니다.", ok: data.ok });
      if (data.ok) {
        setOpen(false);
        onReported();
      }
    } catch {
      setMessage({ text: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요.", ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      {!open && !message?.ok && (
        <button type="button" className="py-2 text-xs underline text-zinc-600 dark:text-zinc-400" onClick={() => setOpen(true)}>
          정보가 틀렸어요
        </button>
      )}
      {open && (
        <form className="mt-1 flex flex-col gap-2 rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700" onSubmit={submit}>
          <fieldset className="flex flex-col gap-1">
            <legend className="text-xs text-zinc-600 dark:text-zinc-400">무엇이 틀렸나요?</legend>
            {(Object.keys(REPORT_REASONS) as ReportReason[]).map((key) => (
              <label key={key} className="flex items-center gap-2">
                <input type="radio" name={`reason-${orgId}`} checked={reason === key} onChange={() => setReason(key)} />
                {REPORT_REASONS[key]}
              </label>
            ))}
          </fieldset>
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            자세한 내용 (선택, 개인 연락처는 적지 마세요)
            <textarea
              className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-900"
              rows={2}
              maxLength={MAX_DETAIL_LENGTH}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className="rounded bg-emerald-700 px-3 py-1 text-white disabled:opacity-50" disabled={!reason || loading}>
              신고하기
            </button>
            <button type="button" className="rounded border border-zinc-300 px-3 py-1 dark:border-zinc-600" onClick={() => setOpen(false)}>
              취소
            </button>
          </div>
        </form>
      )}
      {message && (
        <p className={`mt-1 text-xs ${message.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-700"}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  );
}
