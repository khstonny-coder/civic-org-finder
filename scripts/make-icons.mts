// 홈 화면 아이콘 만들기 (PLAN 작업 17번): `npm run icons:make`
// 글자 없이 도형만으로 그린 간단한 아이콘(여러 사람이 모인 모양)을 PNG로 저장한다. (글꼴이 없는 환경에서도 같게 나오도록)
// 결과: public/icons/icon-192.png, icon-512.png, maskable-512.png(가장자리 잘려도 안전한 여백 포함), apple-touch-icon.png
import { mkdirSync } from "node:fs";
import sharp from "sharp";

const GREEN = "#047857";

// safe: 가운데 도형이 차지하는 비율. maskable은 기기가 가장자리를 둥글게 자르므로 더 작게 그린다.
function svg(size: number, safe: number, rounded: boolean): string {
  const c = size / 2;
  const u = (size * safe) / 100; // 도형 기준 길이
  const person = (cx: number, cy: number, r: number) =>
    `<circle cx="${cx}" cy="${cy - r * 1.1}" r="${r * 0.55}" fill="#fff"/>` +
    `<path d="M ${cx - r} ${cy + r * 0.9} a ${r} ${r} 0 0 1 ${2 * r} 0 z" fill="#fff"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.22 : 0}" fill="${GREEN}"/>
  ${person(c - u * 0.28, c + u * 0.12, u * 0.2)}
  ${person(c + u * 0.28, c + u * 0.12, u * 0.2)}
  ${person(c, c + u * 0.2, u * 0.26)}
</svg>`;
}

mkdirSync(new URL("../public/icons/", import.meta.url), { recursive: true });
const out = (name: string) => new URL(`../public/icons/${name}`, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

await sharp(Buffer.from(svg(192, 78, true))).png().toFile(out("icon-192.png"));
await sharp(Buffer.from(svg(512, 78, true))).png().toFile(out("icon-512.png"));
await sharp(Buffer.from(svg(512, 56, false))).png().toFile(out("maskable-512.png"));
await sharp(Buffer.from(svg(180, 70, false))).png().toFile(out("apple-touch-icon.png"));
console.log("✅ public/icons/ 에 아이콘 4개를 만들었습니다.");
