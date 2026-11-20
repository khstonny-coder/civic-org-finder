// 개인 연락처 거르기 (PLAN 작업 5번에서 만들고, 18번에서 단체 직접 입력에도 쓰도록 공용으로 옮겼다. DESIGN 8번 판별 규칙)
// 수집 프로그램(scripts/collect)과 단체 담당자 신청(app/api/submissions)이 같은 규칙을 쓴다.
// 기관 명의로 공개된 대표 연락처만 남기고, 휴대전화·무료 메일·출처 없는 연락처는 지운다.

export type ContactInput = {
  phone?: string | null;
  email?: string | null;
  source_url?: string | null;
  /** 자료가 "기관 대표 연락처"로 밝힌 것인가 (무료 메일이어도 대표로 밝혔으면 남긴다) */
  labeled_representative?: boolean;
};

const MOBILE_PREFIX = /^01[016789]/;
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "naver.com", "daum.net", "hanmail.net", "kakao.com", "nate.com",
  "hotmail.com", "outlook.com", "yahoo.com", "yahoo.co.kr", "icloud.com",
]);
// 사업내용 안에 섞여 들어온 연락처 표현 (휴대전화, 이메일, 주민등록번호 모양)
const TEXT_MOBILE = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g;
const TEXT_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const TEXT_RESIDENT_ID = /\d{6}[-\s]?[1-4]\d{6}/g;

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

/** 사업내용 같은 글에 섞인 휴대전화·이메일·주민등록번호 모양을 지운다. */
export function stripPersonalText(text: string): { text: string; removed: boolean } {
  const cleaned = text
    .replace(TEXT_RESIDENT_ID, "")
    .replace(TEXT_MOBILE, "")
    .replace(TEXT_EMAIL, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { text: cleaned, removed: cleaned !== text.trim() };
}

/** 전화·이메일을 DESIGN 8번의 판별 규칙으로 거른다. */
export function filterContact(contact: ContactInput | undefined): {
  phone: string | null;
  email: string | null;
  source_url: string | null;
  notes: string[];
} {
  const notes: string[] = [];
  let phone: string | null = null;
  let email: string | null = null;
  if (!contact) return { phone, email, source_url: null, notes };

  if (contact.phone) {
    const digits = digitsOf(contact.phone);
    if (MOBILE_PREFIX.test(digits)) notes.push("휴대전화 번호 제거");
    else if (digits.length < 7) notes.push("전화번호 형식 이상으로 제거");
    else phone = contact.phone.trim();
  }

  if (contact.email) {
    const value = contact.email.trim();
    const domain = value.split("@")[1]?.toLowerCase() ?? "";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) notes.push("이메일 형식 이상으로 제거");
    else if (FREE_MAIL_DOMAINS.has(domain) && !contact.labeled_representative)
      notes.push("무료 메일(대표 이메일로 표시되지 않음) 제거");
    else email = value;
  }

  // 연락처에는 반드시 출처가 있어야 한다. (DB 규칙과 같다)
  const hasSource = !!contact.source_url && isHttpUrl(contact.source_url);
  if ((phone || email) && !hasSource) {
    notes.push("연락처 출처 없음으로 제거");
    phone = null;
    email = null;
  }
  return { phone, email, source_url: phone || email ? (contact.source_url ?? null) : null, notes };
}
