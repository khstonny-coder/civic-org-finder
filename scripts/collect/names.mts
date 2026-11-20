// 단체 이름 정리 (PLAN 작업 6번, DESIGN 4.2): 같은 단체가 표기만 달라 따로 저장되지 않도록
// "(사)·(재) 같은 법인 표기"와 띄어쓰기·기호를 없앤 비교용 이름을 만든다.
// DB의 organizations.name_normalized 값이 되고, (정리된 이름 + 시·군·구)가 같으면 같은 단체로 본다.

// 이름 앞뒤의 법인 구분 표기: (사) (재) (주) (유) (합) 등. 전각(㈔ ㈜)은 아래 NFKC 변환에서 먼저 "(사)" "(주)"로 바뀐다.
const CORPORATE_MARK = /[(\[]\s*(사|재|주|유|합|학|의|사단법인|재단법인|사회복지법인|비영리법인|비영리민간단체)\s*[)\]]/g;
// 괄호 없이 말로 쓴 법인 표기
const CORPORATE_WORD = /(사단법인|재단법인|사회복지법인|비영리법인|비영리민간단체)/g;
// 앞에서 괄호 한쪽이 빠진 경우: "사)가평군새마을회"
const BROKEN_MARK = /^\s*(사|재)\)/;
// 비교에 필요 없는 공백과 기호
const NOISE = /[\s·ㆍ・.,;:'"`~!@#$%^&*_+=|\\/<>?\-–—()[\]{}「」『』《》〈〉]/g;

export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(BROKEN_MARK, "")
    .replace(CORPORATE_MARK, "")
    .replace(CORPORATE_WORD, "")
    .replace(NOISE, "");
}
