// 저장 전 검사 (PLAN 작업 5번, DESIGN 4.2 수집 흐름의 "검사 1~3", PRD 5-must2·7번)
// 수집한 단체 한 건이 DB에 저장해도 되는지 판단한다.
//  검사 1: 단체명·지역(시·군·구)·분야·출처 URL이 모두 있는가
//  검사 2: 단체 유형 판정 — 협동조합·사회적 기업, 종교·친목·노조 단체는 제외하고 사유를 남긴다
//  검사 3: 개인 연락처처럼 보이는 것은 걸러낸다 (기관 명의로 공개된 대표 연락처만 남긴다)
import { filterContact, isHttpUrl, stripPersonalText, type ContactInput } from "../../lib/orgs/contact.ts";
import { REASON_LABELS } from "../../lib/orgs/reason-labels.ts";
import { classifyField, type FieldName } from "./fields.mts";
import { normalizeName } from "./names.mts";
import { findRegion } from "./regions.mts";

// 연락처 거르기는 단체 직접 입력(PLAN 18번)과 함께 쓰려고 lib/orgs/contact.ts로 옮겼다. 기존 import가 깨지지 않게 다시 내보낸다.
export { filterContact, stripPersonalText, REASON_LABELS };

export type Candidate = {
  name: string;
  region_code: string | null;
  description: string | null;
  source_url: string | null;
  collected_at: string;
  /** 연락처가 있는 자료일 때만 채운다. 연락처의 출처 URL과, 자료가 "대표 연락처"로 밝혔는지 함께 받는다. */
  contact?: ContactInput;
};

export type CheckedOrg = {
  name: string;
  region_code: string;
  field: FieldName;
  description: string | null;
  source_url: string;
  collected_at: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
};

export type CheckResult =
  | { ok: true; org: CheckedOrg; notes: string[] }
  | { ok: false; reasons: string[] };

// ─── 검사 2: 단체 유형 ───
// "이름 + 사업내용"에서 분명한 표현만 본다. 헷갈리는 말은 일부러 넣지 않았다. (정확도 한계는 DESIGN 9번 참고)
const TYPE_RULES: { reason: string; name: RegExp; description?: RegExp }[] = [
  { reason: "excluded_cooperative", name: /협동조합|사회적\s*기업/, description: /협동조합|사회적\s*기업/ },
  {
    reason: "excluded_religion",
    name: /교회|성당|사찰|불교|천주교|기독교|원불교|천도교|교구|선교|포교|종단|교단|목회/,
    description: /선교|포교|예배|전도/,
  },
  { reason: "excluded_social_club", name: /동창회|향우회|종친회|친목|화수회|동호회|계모임|동문회/ },
  { reason: "excluded_labor_union", name: /노동조합|노조/, description: /노동조합|노조/ },
];

export function checkOrganization(candidate: Candidate): CheckResult {
  const reasons: string[] = [];
  const notes: string[] = [];

  // 검사 1: 필수 항목
  const name = candidate.name.replace(/\s+/g, " ").trim();
  // "(사)"처럼 법인 표기만 있는 이름도 비교용 이름이 비어 버리므로 단체명 없음으로 본다.
  if (name.length < 2 || normalizeName(name).length < 2) reasons.push("missing_name");
  if (!candidate.region_code || !findRegion(candidate.region_code)) reasons.push("missing_region");
  if (!candidate.source_url) reasons.push("missing_source_url");
  else if (!isHttpUrl(candidate.source_url)) reasons.push("invalid_source_url");

  // 사업내용에서 개인 연락처 모양을 먼저 지운다.
  let description: string | null = null;
  if (candidate.description) {
    const stripped = stripPersonalText(candidate.description);
    description = stripped.text || null;
    if (stripped.removed) notes.push("사업내용에 섞인 개인 연락처 모양 제거");
  }

  // 검사 2: 단체 유형
  for (const rule of TYPE_RULES) {
    if (rule.name.test(name) || (description && rule.description?.test(description))) {
      reasons.push(rule.reason);
    }
  }

  if (reasons.length > 0) return { ok: false, reasons };

  // 검사 3: 연락처
  const contact = filterContact(candidate.contact);
  notes.push(...contact.notes);

  const field = classifyField(name, description);
  if (field === "기타") notes.push("분야를 정하지 못해 기타로 둠");

  return {
    ok: true,
    notes,
    org: {
      name,
      region_code: candidate.region_code as string,
      field,
      description,
      source_url: candidate.source_url as string,
      collected_at: candidate.collected_at,
      contact_phone: contact.phone,
      contact_email: contact.email,
      contact_source_url: contact.source_url,
    },
  };
}
