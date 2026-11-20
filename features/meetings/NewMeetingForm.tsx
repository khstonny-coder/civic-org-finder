"use client";
// 새 간담회 만들기 양식 (PLAN 작업 16번). 간담회 목록 화면과 챗봇 결과("이 단체들로 간담회 만들기")에서 함께 쓴다.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MAX_TITLE_LENGTH } from "../../lib/meetings/validate.ts";

export function NewMeetingForm({
  orgIds = [],
  regionCode,
  defaultTitle = "",
  onCancel,
}: {
  orgIds?: string[];
  regionCode?: string;
  defaultTitle?: string;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [heldOn, setHeldOn] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, heldOn, regionCode, orgIds }),
      });
      const data: { ok: boolean; id?: string; message?: string } = await res.json();
      if (data.ok && data.id) {
        router.push(`/meetings/${data.id}`);
        return;
      }
      setError(data.message ?? "만들지 못했습니다.");
    } catch {
      setError("연결에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700" onSubmit={submit}>
      {orgIds.length > 0 && <p className="text-sm">지금 보이는 단체 {orgIds.length}곳을 초청 목록에 넣습니다.</p>}
      <label className="text-sm">
        제목
        <input
          required
          maxLength={MAX_TITLE_LENGTH}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="예: 마포구 환경 단체 간담회"
        />
      </label>
      <label className="text-sm">
        간담회 날짜
        <input
          required
          type="date"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
          value={heldOn}
          onChange={(e) => setHeldOn(e.target.value)}
        />
      </label>
      <p className="text-xs text-zinc-500">간담회 기록(초청·참석 상태)은 간담회일로부터 90일 뒤 자동으로 삭제됩니다.</p>
      {error && <p className="text-sm text-red-700" role="status">{error}</p>}
      <div className="flex gap-2">
        <button className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" disabled={loading}>
          간담회 만들기
        </button>
        {onCancel && (
          <button type="button" className="rounded-lg border border-zinc-300 px-4 py-2 dark:border-zinc-600" onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
