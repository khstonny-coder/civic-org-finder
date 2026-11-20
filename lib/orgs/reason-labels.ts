// 제외·저장 거부 사유 이름 (수집 결과 기록의 "사유별 건수"에 쓴다)
// 수집 프로그램과 관리자 화면(PLAN 19번)이 함께 쓰려고 공용 폴더에 두었다.
export const REASON_LABELS: Record<string, string> = {
  missing_name: "단체명 없음",
  missing_region: "시·군·구를 정하지 못함",
  missing_source_url: "출처 URL 없음",
  invalid_source_url: "출처 URL이 올바르지 않음",
  excluded_cooperative: "협동조합·사회적 기업",
  excluded_religion: "종교 단체",
  excluded_social_club: "친목 단체",
  excluded_labor_union: "노동조합",
};
