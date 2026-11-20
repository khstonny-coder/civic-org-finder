// 홈 화면에 추가할 때 쓰는 앱 정보 (PLAN 작업 17번). 별도 앱이 아니라 웹 화면을 앱처럼 띄운다. (네이티브 앱은 만들지 않는다 — PRD)
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우리동네 시민단체 찾기",
    short_name: "시민단체 찾기",
    description: "간담회를 열 지역의 시민단체를 출처와 함께 찾아 드립니다.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#047857",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
