"use client";
// 챗봇 화면 (PLAN 작업 9번, DESIGN 3.2): 입력창 + 분야 칩 + 단체 카드 목록 + 더 보기 + 인접 지역 요청 + 0곳 안내
import { useState } from "react";
import { FIELD_NAMES } from "../../lib/search/fields.ts";
import { NewMeetingForm } from "../meetings/NewMeetingForm.tsx";
import { OrgCard } from "./OrgCard.tsx";
import type { ChatRequest, ChatResponse } from "./types.ts";

type OkResponse = Extract<ChatResponse, { status: "ok" }>;

// canMakeMeeting: 간담회는 공무원 본인만 쓸 수 있다. (관리자에게는 "간담회 만들기" 버튼을 보이지 않는다)
export function ChatBox({ canMakeMeeting }: { canMakeMeeting: boolean }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [items, setItems] = useState<OkResponse["items"]>([]);
  // 안내 문장은 첫 화면의 것만 유지한다. ("더 보기" 응답에는 문장이 없다)
  const [guide, setGuide] = useState<string | null>(null);
  const [showMeetingForm, setShowMeetingForm] = useState(false);

  async function ask(req: ChatRequest, append = false) {
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
      });
      const data: ChatResponse = await res.json();
      setResult(data);
      if (data.status === "ok") {
        setItems((prev) => (append ? [...prev, ...data.items] : data.items));
        if (!append) setGuide(data.guide);
      } else {
        setItems([]);
        setGuide(null);
      }
    } catch {
      setResult({ status: "error", message: "연결에 실패했습니다. 잠시 후 다시 시도해 주세요." });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const ok = result?.status === "ok" ? result : null;

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-xl font-bold">우리동네 시민단체 찾기</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        간담회를 열 시·군·구를 입력하면 그 지역의 시민단체를 출처와 함께 알려 드립니다.
      </p>

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (text.trim()) ask({ text });
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-base dark:border-zinc-600 dark:bg-zinc-900"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 마포구, 수원시 팔달구"
          aria-label="지역 입력"
          maxLength={200}
        />
        <button
          className="shrink-0 rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50"
          disabled={loading || !text.trim()}
        >
          찾기
        </button>
      </form>

      <div className="mt-6" aria-live="polite">
        {loading && <p className="text-sm text-zinc-500">찾는 중…</p>}

        {result?.status === "error" && <p className="text-sm text-red-700">{result.message}</p>}
        {result?.status === "none" && <p className="text-sm">{result.message}</p>}

        {result?.status === "ambiguous" && (
          <div>
            <p className="text-sm">같은 이름의 지역이 여러 곳입니다. 어디인가요?</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {result.candidates.map((c) => (
                <button
                  key={c.code}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
                  onClick={() => ask({ regionCode: c.code, field: result.field ?? "" })}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {ok && (
          <div>
            <p className="text-sm font-medium">
              {ok.region.label}
              {ok.includeNeighbors ? " + 인접 지역" : ""}
              {ok.field ? ` · ${ok.field}` : ""}: 모두 {ok.total}곳
            </p>
            {/* 분야 칩: 누르면 그 분야만 다시 찾는다. "전체"를 누르면 필터를 푼다. */}
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="분야 필터">
              {[null, ...FIELD_NAMES].map((f) => {
                const active = (ok.field ?? null) === f;
                return (
                  <button
                    key={f ?? "all"}
                    aria-pressed={active}
                    disabled={loading}
                    className={`rounded-full border px-3 py-1 text-sm ${
                      active
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-zinc-300 dark:border-zinc-600"
                    }`}
                    onClick={() => ask({ regionCode: ok.region.code, includeNeighbors: ok.includeNeighbors, field: f ?? "" })}
                  >
                    {f ?? "전체"}
                  </button>
                );
              })}
            </div>
            {guide && <p className="mt-2 text-sm">{guide}</p>}
            {ok.total === 0 && (
              <div className="mt-2">
                <p className="text-sm">DB에서 찾지 못했습니다. (없는 단체를 만들어 내지 않습니다)</p>
                {ok.suggestions.length > 0 ? (
                  <>
                    <p className="mt-3 text-sm">같은 시·도에서 단체가 등록된 다른 지역입니다.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ok.suggestions.map((s) => (
                        <button
                          key={s.code}
                          className="rounded-full border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-600"
                          disabled={loading}
                          onClick={() => ask({ regionCode: s.code, field: ok.field ?? "" })}
                        >
                          {s.label} ({s.count}곳)
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    같은 시·도에도 아직 등록된 단체가 없습니다.
                  </p>
                )}
              </div>
            )}
            <ul className="mt-3 flex flex-col gap-3">
              {items.map((org) => (
                <OrgCard key={org.id} org={org} />
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              {ok.hasMore && (
                <button
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                  disabled={loading}
                  onClick={() =>
                    ask(
                      { regionCode: ok.region.code, includeNeighbors: ok.includeNeighbors, field: ok.field ?? "", offset: items.length },
                      true,
                    )
                  }
                >
                  더 보기
                </button>
              )}
              {!ok.includeNeighbors && (
                <button
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                  disabled={loading}
                  onClick={() => ask({ regionCode: ok.region.code, includeNeighbors: true, field: ok.field ?? "" })}
                >
                  인접 지역도 보기
                </button>
              )}
            </div>
            {ok.total > 0 && (
              <div className="mt-4">
                {/* 보이는 10곳이 아니라 지금 조건에 맞는 단체 전부를 내려받는다 */}
                <a
                  className="inline-block rounded-lg border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
                  href={`/api/export?regionCode=${ok.region.code}&includeNeighbors=${ok.includeNeighbors}&field=${encodeURIComponent(ok.field ?? "")}`}
                  download
                >
                  엑셀 내려받기 ({ok.total}곳)
                </a>
              </div>
            )}
            {canMakeMeeting && items.length > 0 && (
              <div className="mt-4">
                {showMeetingForm ? (
                  <NewMeetingForm
                    orgIds={items.map((o) => o.id)}
                    regionCode={ok.region.code}
                    defaultTitle={`${ok.region.label} 시민단체 간담회`}
                    onCancel={() => setShowMeetingForm(false)}
                  />
                ) : (
                  <button
                    className="rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-800 dark:text-emerald-300"
                    onClick={() => setShowMeetingForm(true)}
                  >
                    이 단체들로 간담회 만들기
                  </button>
                )}
              </div>
            )}
            <p className="mt-4 text-xs text-zinc-500">AI 안내는 참고용이니 연락 전 출처를 확인하세요.</p>
          </div>
        )}
      </div>
    </section>
  );
}
