// 역할과 가입 허용 도메인 규칙 (PLAN 작업 13번, DESIGN 4.5·8번). DB·쿠키 없이 계산만 해서 시험하기 쉽게 둔다.

export type Role = "official" | "org_pending" | "org" | "admin";

/** 항상 허용하는 공공기관 도메인. 관리자가 늘리려면 .env의 ALLOWED_EMAIL_DOMAINS에 쉼표로 추가한다. */
export const DEFAULT_ALLOWED_DOMAINS = ["go.kr", "korea.kr"];

/** 기본 도메인 + .env에서 추가한 도메인 (소문자, 앞의 @·공백 제거) */
export function allowedDomains(extra: string | undefined): string[] {
  const added = (extra ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter((d) => d.includes("."));
  return [...new Set([...DEFAULT_ALLOWED_DOMAINS, ...added])];
}

export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254;
}

/**
 * 허용 도메인의 이메일인가. 하위 도메인은 허용한다. (예: mapo.seoul.go.kr → go.kr)
 * "evilgo.kr"처럼 이름만 비슷한 도메인은 허용하지 않는다.
 */
export function isAllowedOfficialEmail(email: string, domains: string[]): boolean {
  if (!isValidEmail(email)) return false;
  const host = email.split("@")[1].toLowerCase();
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** 챗봇(검색)을 쓸 수 있는 역할: 공무원과 관리자 */
export function canUseChat(role: Role | null | undefined): boolean {
  return role === "official" || role === "admin";
}

/**
 * 새 가입자를 공무원으로 올려도 되는가.
 * 이메일 인증이 끝났고, 허용 도메인이며, 아직 단체 담당자 신청 정보가 없는 "승인 대기" 계정만 해당한다.
 * (가입 경로와 상관없이 "허용 도메인 메일함을 가진 사람"이라는 사실만 믿는다)
 */
export function shouldBecomeOfficial(input: {
  role: Role;
  orgId: string | null;
  orgNameRequested: string | null;
  email: string;
  emailConfirmed: boolean;
  domains: string[];
}): boolean {
  return (
    input.role === "org_pending" &&
    input.orgId === null &&
    !input.orgNameRequested &&
    input.emailConfirmed &&
    isAllowedOfficialEmail(input.email, input.domains)
  );
}
