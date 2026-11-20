# 배포 안내 (PLAN 작업 23번)

이 문서는 "우리동네 시민단체 찾기"를 Vercel에 올리기 전에 할 일과 올린 뒤 확인할 일을 순서대로 적은 것입니다.
실제 배포(공개)는 이 목록을 마치고 **사람이 결정해서** 하는 것을 전제로 합니다. 이 작업에서는 배포하지 않았습니다.

## 1. 배포 전에 끝내야 하는 것 (막힘)

| 순서 | 할 일 | 이유 |
|---|---|---|
| 1 | Supabase 화면 → Authentication → Providers → Email 에서 **"Confirm email" 켜기** | 꺼져 있으면 아무 `*.go.kr` 주소로 가입만 해도 공무원이 됩니다. (보안 검토 SEC-001) |
| 2 | 보안 강화 DB 변경 적용: `supabase/migrations/20261120070000_security_hardening.sql` | 앱을 거치지 않는 직접 요청도 같은 규칙에 걸리게 합니다. (SEC-002, 003, 009) |
| 3 | 관리자 계정 1개 지정: Supabase 화면 → Table Editor → `profiles` → 본인 행의 `role`을 `admin`으로 | 앱에서는 관리자 가입이 안 됩니다. |
| 4 | 경기데이터드림 인증키로 전체 수집 후 `npm run metrics:check`로 점검 | 지금 DB에는 시험 단체 4곳뿐입니다. 시험 때 쌓인 `chat_logs`도 비워야 지표가 정확합니다. |

## 2. Vercel에 등록할 환경변수

`.env.example`의 목록과 같습니다. 값은 Vercel 프로젝트 화면 → Settings → Environment Variables에 직접 넣습니다. (값을 채팅이나 문서에 적지 않습니다.)

| 이름 | 필수 | 비고 |
|---|:-:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | 공개 주소 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 공개용 키 (DB 접근 규칙이 데이터를 막아 줌) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **비밀.** `NEXT_PUBLIC_` 를 붙이지 않습니다. |
| `OPENAI_API_KEY` | ✅ | **비밀.** 없으면 AI 안내 문장 대신 정해진 문장이 나옵니다. |
| `NEXT_PUBLIC_SITE_URL` | ✅ | 배포 주소(예: `https://….vercel.app`). 인증 메일의 돌아올 주소로 씁니다. |
| `ALLOWED_EMAIL_DOMAINS` | 선택 | `go.kr`, `korea.kr` 외에 허용할 도메인(쉼표 구분) |
| `OPENAI_MODEL` | 선택 | 기본 `gpt-4o-mini` |

**Vercel에 넣지 않는 것**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `GITHUB_TOKEN` (내 컴퓨터의 작업용 도구 전용).

## 3. Supabase 화면에서 맞출 설정

- **Authentication → URL Configuration**
  - Site URL: 배포 주소 (`NEXT_PUBLIC_SITE_URL`과 같게)
  - Redirect URLs: 배포 주소의 `/login` **한 줄만** 넣습니다. `*` 같은 와일드카드는 쓰지 않습니다. (SEC-004)
- **Authentication → Email**: "Confirm email" 켜기, "Secure email change" 켜기
- **메일 발송 한도**: Supabase 기본 메일은 시간당 발송 수가 매우 적습니다. 공무원 여러 명이 가입하기 전에 Authentication → SMTP Settings에서 별도 메일 서비스를 연결하세요.
- 비밀번호 정책: 최소 8자 (앱도 8자 이상을 요구합니다.)

## 4. 배포 순서 (Vercel CLI, 토큰은 `.env`의 `VERCEL_TOKEN` 사용)

1. `npm run build`가 통과하는지 확인 (지금 통과합니다)
2. 프로젝트 연결: `npx vercel link` (처음 한 번)
3. 환경변수 등록: Vercel 화면 또는 `npx vercel env add 이름 production`
4. 미리보기 배포로 먼저 확인: `npx vercel` (운영 배포가 아님)
5. 아래 5번 점검을 통과하면 운영 배포: `npx vercel --prod`

## 5. 배포 뒤 점검 (운영 주소에서)

- [ ] 로그인 전 `/`로 가면 `/login`으로 이동한다
- [ ] 공공기관 이메일로 가입 → 인증 메일이 오고 → 링크를 누른 뒤 로그인하면 챗봇이 열린다
- [ ] 일반 메일(gmail 등) 공무원 가입은 "공공기관 이메일만" 안내로 거절된다
- [ ] 지역 검색, 분야 칩, 엑셀 내려받기, 간담회 만들기가 동작한다
- [ ] 관리자 계정으로 `/admin`이 열리고, 공무원 계정은 열리지 않는다
- [ ] 휴대폰(실제 기기)에서 화면이 깨지지 않고 "홈 화면에 추가"가 된다 (HTTPS 필요)
- [ ] Supabase → Database → Cron(또는 `select * from cron.job`)에 `purge-expired-records`가 보인다
- [ ] 브라우저 개발자 도구에서 응답 헤더에 `X-Frame-Options`가 있다

## 6. 알려진 한계 (운영 전 판단 필요)

- 정확도 90%·목록 작성 10분·새 단체 3곳 지표는 전체 수집 후 사람이 재야 합니다.
- 보안 헤더 중 CSP는 넣지 않았습니다. (Next.js 내부 스크립트와 충돌 위험)
- `exceljs`의 의존 도구(`uuid`)에 중간 수준 경고가 있으나 이 앱의 사용 방식에서는 영향이 작습니다.
- 챗봇 AI 호출 제한(1분 20회)은 서버 한 대 기준입니다.
- 오프라인 동작은 지원하지 않습니다.
