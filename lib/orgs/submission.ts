// 단체 담당자의 등록·수정 신청 입력 검사 (PLAN 작업 18번, DESIGN 4.4)
// 담당자가 직접 적은 값이라도 수집 자료와 같은 개인정보 규칙을 적용한다: 휴대전화·무료 메일·출처 없는 연락처는 지우고, 설명에 섞인 개인 연락처 모양도 지운다.
// 단체 유형(비영리민간단체·공익적 시민단체인지)은 관리자가 신청을 볼 때 확인한다. (PLAN 19번)
import { FIELD_NAMES } from "../../scripts/collect/fields.mts";
import { filterContact, isHttpUrl, stripPersonalText } from "./contact.ts";

export const MAX_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 200;

export type SubmissionPayload = {
  name: string;
  region_code: string;
  field: (typeof FIELD_NAMES)[number];
  description: string | null;
  source_url: string;
  contact_phone: string | null;
  contact_email: string | null;
  contact_source_url: string | null;
};

const clean = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

export function parseSubmission(
  body: unknown,
): { ok: true; payload: SubmissionPayload; notes: string[] } | { ok: false; message: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const notes: string[] = [];

  const name = clean(b.name);
  if (name.length < 2) return { ok: false, message: "단체명을 2자 이상 적어 주세요." };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, message: `단체명은 ${MAX_NAME_LENGTH}자 이하로 적어 주세요.` };

  const region = clean(b.region_code);
  if (!/^\d{5}$/.test(region)) return { ok: false, message: "시·군·구를 골라 주세요." };

  const field = clean(b.field);
  if (!(FIELD_NAMES as readonly string[]).includes(field)) return { ok: false, message: "분야를 골라 주세요." };

  const sourceUrl = clean(b.source_url);
  if (!sourceUrl) return { ok: false, message: "출처 URL(단체 홈페이지나 공개 자료 주소)을 적어 주세요." };
  if (!isHttpUrl(sourceUrl) || sourceUrl.length > 500) return { ok: false, message: "출처 URL이 올바르지 않습니다. http:// 또는 https://로 시작해야 합니다." };

  let description: string | null = null;
  const rawDescription = clean(b.description);
  if (rawDescription) {
    if (rawDescription.length > MAX_DESCRIPTION_LENGTH) {
      return { ok: false, message: `소개는 ${MAX_DESCRIPTION_LENGTH}자 이하로 적어 주세요.` };
    }
    const stripped = stripPersonalText(rawDescription);
    if (stripped.removed) notes.push("소개에 섞인 개인 연락처 모양을 지웠습니다.");
    description = stripped.text || null;
  }

  // 연락처: 담당자가 "기관 대표 연락처"라고 직접 밝힌 신청이므로 대표 연락처 표시를 인정하되, 휴대전화·출처 없음은 지운다.
  const contact = filterContact({
    phone: clean(b.contact_phone) || null,
    email: clean(b.contact_email) || null,
    source_url: clean(b.contact_source_url) || null,
    labeled_representative: true,
  });
  notes.push(...contact.notes.map((n) => `연락처: ${n}`));

  return {
    ok: true,
    notes,
    payload: {
      name,
      region_code: region,
      field: field as SubmissionPayload["field"],
      description,
      source_url: sourceUrl,
      contact_phone: contact.phone,
      contact_email: contact.email,
      contact_source_url: contact.source_url,
    },
  };
}

/** 가입할 때 적는 단체명 검사 (DB trigger가 100자까지만 저장한다) */
export function parseOrgName(value: unknown): string | null {
  const name = clean(value);
  return name.length >= 2 && name.length <= MAX_NAME_LENGTH ? name : null;
}
