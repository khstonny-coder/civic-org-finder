"use client";
// 단체 카드 (DESIGN 3.2): 단체명, 지역, 분야, 한 줄 설명, 대표 연락처(있을 때), 출처 링크, 수집일, 신고 버튼
import { useState } from "react";
import { REVIEW_LABELS } from "../../lib/search/review.ts";
import { ReportButton } from "./ReportButton.tsx";
import type { ChatResponse } from "./types.ts";

type Item = Extract<ChatResponse, { status: "ok" }>["items"][number];

export function OrgCard({ org }: { org: Item }) {
  const [reported, setReported] = useState(false); // 방금 신고했으면 바로 "확인 필요"로 보여 준다
  const reason = reported ? "reported" : org.review_reason;
  const collected = org.collected_at.slice(0, 10);
  return (
    <li className="border-t-4 border-t-black border-x border-b border-x-zinc-200 border-b-zinc-200 bg-white p-4 dark:border-x-zinc-700 dark:border-b-zinc-700 dark:border-t-white dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-base font-semibold break-words">{org.name}</h3>
        {org.from_neighbor && (
          <span className="rounded bg-sky-100 px-2 py-0.5 text-xs text-sky-800">인접 지역</span>
        )}
        {reason && <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">확인 필요</span>}
      </div>
      {reason && (
        <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
          {REVIEW_LABELS[reason]}. 연락 전 출처를 꼭 확인해 주세요.
        </p>
      )}
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {org.regionLabel} · {org.field}
      </p>
      {org.description && <p className="mt-2 text-sm break-words">{org.description}</p>}
      {(org.contact_phone || org.contact_email) && (
        <p className="mt-2 text-sm">
          대표 연락처: {[org.contact_phone, org.contact_email].filter(Boolean).join(" / ")}
          {org.contact_source_url && (
            <>
              {" "}
              <a className="underline" href={org.contact_source_url} target="_blank" rel="noopener noreferrer">
                (연락처 출처)
              </a>
            </>
          )}
        </p>
      )}
      <p className="mt-1 text-xs text-zinc-500">
        <a className="inline-block py-2 underline" href={org.source_url} target="_blank" rel="noopener noreferrer">
          출처 보기
        </a>{" "}
        · 수집일 {collected}
      </p>
      <ReportButton orgId={org.id} onReported={() => setReported(true)} />
    </li>
  );
}
