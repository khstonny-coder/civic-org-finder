import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 보안 헤더 (PLAN 23번 보안 검토 반영): 다른 사이트가 우리 화면을 틀 안에 넣어 클릭을 유도하는 것(클릭재킹)을 막고,
  // 파일 종류 추측과 주소 노출을 줄이고, 배포 주소에서는 항상 https로만 접속하게 한다.
  // (CSP는 Next.js의 내부 스크립트와 충돌할 수 있어 이번에는 넣지 않았다.)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
