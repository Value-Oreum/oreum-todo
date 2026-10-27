# What to do for OREUM

오름 팀을 위한 실시간 업무 매트릭스. Next.js + Supabase + Vercel.

## 로컬 실행

Node.js 24 이상. 기존 `/workspace/oreum-todo` 체크아웃을 사용하세요. 클라우드 작업은 이미 격리되어 있으므로 별도 worktree는 필요하지 않습니다.

```sh
cd /workspace/oreum-todo
npm --cache /workspace/.npm-cache ci
npm run dev
```

설정 없이 랜딩에서 **데모 워크스페이스 둘러보기**로 사용 가능합니다. 데모 업무는 해당 브라우저 localStorage에만 저장됩니다. 로그인·팀 동기화·AI·메일은 데모에서 실행되지 않습니다. 데모는 보안 경계를 대체하지 않으며 실제 DB 권한은 RLS로 별도 보호됩니다.

검증: `npm test`, `npm run typecheck`, `npm run build`.

## 실제 서비스 연결 순서

1. 이 저장소를 GitHub에 올리고 Vercel에서 Import Git Repository → Next.js로 가져옵니다. 아직 배포·푸시는 수행하지 않았습니다.
2. Supabase 프로젝트를 만들고 SQL Editor에서 `supabase/schema.sql`을 **한 번** 실행합니다. 새 프로젝트용 스키마이며 재실행용 migration은 아닙니다.
3. Supabase Authentication → Providers에서 Google을 켭니다. Google Cloud OAuth 앱에 Supabase의 OAuth callback을 등록합니다. Supabase URL Configuration의 Site URL 및 Redirect URLs에는 Vercel 서비스 주소와 개발 주소를 등록합니다.
4. Vercel 프로젝트의 **Settings → Environment Variables**에 아래 항목을 등록합니다. Production/Preview 범위를 구분하고, 키를 추가한 뒤 Redeploy합니다. 로컬에서는 `.env.example`을 복사한 `.env.local`에 입력하세요. `.env.local`은 Git에서 제외됩니다. 키를 채팅·GitHub 소스에 넣지 마세요.
5. Resend에서 보유 도메인을 인증하고 `RESEND_FROM`을 인증된 발신자로 지정합니다. 테스트 도메인으로 임의의 팀 주소에 보낼 수 있다고 가정하지 마세요.
6. 실제 로그인과 두 계정 동시 접속으로 동기화를 검증하고, 테스트 업무에 알림을 켠 뒤 예약 작업과 메일 수신을 검증합니다. 초기 세 주소는 첫 로그인 시 승인됩니다. 이후 계정은 첫 로그인 후 관리자 승인이 필요합니다.

| 환경 변수                       | 입력 위치 / 용도                                                              |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase Project Settings → API의 프로젝트 URL                                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase의 클라이언트용 anon 키. RLS와 함께 사용                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | Supabase 서버 전용 service_role 키. 절대 NEXT_PUBLIC 접두사를 붙이지 않음     |
| `NEXT_PUBLIC_APP_URL`           | 실제 Vercel 서비스 주소, 예: https://your-app.vercel.app                      |
| `ANTHROPIC_API_KEY`             | Anthropic Claude 프로젝트 API 키, 서버에서만 사용                             |
| `ANTHROPIC_MODEL`               | 기본값 `claude-haiku-4-5-20251001`, 프로젝트에서 이용 가능한 이미지 지원 모델 |
| `RESEND_API_KEY`                | Resend API Keys에서 발급한 메일 발송 키                                       |
| `RESEND_FROM`                   | OREUM <alerts@notify.oreumnet.com>                                            |
| `CRON_SECRET`                   | 충분히 긴 임의 비밀 문자열. Vercel Cron 요청 인증용                           |

초기 관리자: `eastsea.chae@gmail.com`. 초기 멤버: `unboundedvalue@gmail.com`, `echa.value@gmail.com`.

## 매트릭스와 변경 이력

중요도/긴급도는 1~5이며 3 이상이 높은 영역입니다. 난이도는 카드 점으로 분리합니다. 최초 기준값은 DB에서 고정하고 변경 사유를 남깁니다. 클라이언트가 히스토리를 조작해도 서버가 다시 생성하며 `task_events`에 변경 전후 전체 데이터를 추가 기록합니다. 일반 멤버는 아카이브를 수정·삭제할 수 없습니다. 낮은 중요도·낮은 긴급도이면서 14일 이상 변경이 없는 업무에만 지속 여부 검토 표시가 나옵니다. 드롭은 사용자가 결정합니다.

동시 편집은 읽었던 `updated_at`과 일치할 때만 저장합니다. 충돌하면 최신 내용을 열어 다시 편집해야 합니다. 삭제는 복구 가능한 휴지통 이동입니다.

## 알림과 비용 제한

알림 스케줄러는 **Cloudflare Workers 무료 플랜의 Cron Trigger**로 분리했습니다. `cloudflare/wrangler.jsonc`의 `0 0 * * *`는 **한국 시간 매일 오전 9시(UTC 00:00)** 실행입니다. 이때까지 기준 시각이 지난 업무를 오래된 순으로 최대 5건 처리하고, 초과분은 다음 일일 실행으로 이월합니다. 즉시 알림이나 정확한 9시 수신을 보장하지 않습니다. 완료·드롭·휴지통 및 알림을 끈 업무는 발송하지 않습니다.

`vercel.json`의 Cron은 제거했으므로 두 스케줄러가 중복 실행되지 않습니다. 회사 서비스는 Vercel Hobby의 비상업용 조건에 맞지 않으므로 앱 자체의 호스팅까지 무료로 준비됐다는 의미는 아닙니다. 앱은 루트 `wrangler.jsonc`의 별도 OpenNext Worker로 배포합니다. `cloudflare/wrangler.jsonc`는 메일 알림 전용입니다.

### Cloudflare 알림 Worker 연결

1. Cloudflare 계정에서 **Workers Free**를 사용합니다. 유료 플랜 전환은 필요하지 않습니다.
2. 로컬에서 `npx wrangler login` 후 `npx wrangler deploy --config cloudflare/wrangler.jsonc`로 알림 전용 Worker를 배포합니다. 이 작업은 아직 실행하지 않았습니다.
3. Cloudflare Dashboard → Workers & Pages → `oreum-daily-reminders` → Settings → Variables and Secrets에 다음 값을 등록하고 적용합니다. 키는 Secret으로 지정합니다.

| Worker 변수                 | 값                                                               |
| --------------------------- | ---------------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase 프로젝트 URL (`NEXT_PUBLIC_SUPABASE_URL`과 동일한 주소) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서버 전용 키, Secret으로 저장                           |
| `RESEND_API_KEY`            | Resend 발송 키, Secret으로 저장                                  |
| `RESEND_FROM`               | `OREUM <alerts@notify.oreumnet.com>`                             |
| `APP_URL`                   | 업무 매트릭스가 실제 배포된 주소                                 |

4. Triggers의 일일 Cron 설정을 확인하고, 알림 업무를 만들어 다음 실행의 Worker Logs와 Supabase `reminder_jobs`, 실제 메일 수신을 확인합니다. Secret 설정 전 실행은 실패하며 메일을 보내지 않습니다.
5. `npm run worker:check`는 외부 배포 없이 번들만 확인합니다. Free Worker의 일일 요청·CPU·subrequest 한도와 Resend 무료 한도를 실제 계정에서 확인하세요. 작은 일일 배치와 DB 상한으로 사용량을 제한하며 유료 전환이나 자동 충전은 설정하지 않습니다.

공개 HTTP 경로는 404이며 Cron만 실행할 수 있습니다. 수동 진단용 `/api/reminders`는 기존 `CRON_SECRET` 인증을 유지합니다. Resend 발송 키는 자동 알림용 Worker에만 등록해도 되며 수동 진단 API를 사용하려면 앱 서버에도 별도 등록해야 합니다.

- 서버가 매 실행 최대 5건을 처리합니다. 요청 간 600ms 간격으로 순차 발송합니다.
- DB 기본 상한은 **하루 80건 / 월 1,500건**의 발송 예약입니다. 가입 요금제에 맞춰 `claim_reminders` 함수를 조정하세요. 이 서비스 밖의 발송량까지 통제하지는 않습니다.
- 업무+예약시각 유일키와 Resend idempotency 키로 중복 발송을 막습니다. 예약 후 실패·결과 불명인 건은 자동 재시도하지 않습니다. Supabase `reminder_jobs`의 `failed`/장시간 `processing` 상태를 운영자가 확인해야 합니다.
- 한도 초과 업무는 예약하지 않고 다음 실행까지 남겨둡니다. 완료·드롭·휴지통 업무와 해제된 멤버는 발송 대상에서 제외합니다.
- 반복 연락은 발송 완료 시점부터 7/14/30일 후로 예약합니다. 실제 수신함의 회신을 감지하지는 않습니다.
- AI는 사용자당 하루 20회, 전체 월 200회로 DB에서 제한합니다. 실패한 호출도 보수적으로 차감합니다. Anthropic Claude 콘솔에서도 프로젝트 예산·사용 알림을 설정하세요. 호출 횟수 제한이 정확한 금액 한도를 보장하지는 않습니다.
- 캡처는 최대 5MB, 텍스트는 12,000자. 원본은 저장하지 않으며 외부 AI 전송 안내를 표시합니다. 추출은 한 번에 한 업무 초안입니다.

## 아직 연결·검증이 필요한 항목

- 실제 Supabase 프로젝트, Google OAuth, Realtime 연결
- 인증된 Resend 발신 도메인과 실제 메일 수신
- Anthropic Claude 프로젝트 키와 실제 이미지 분석
- GitHub 저장 및 앱 배포, Cloudflare 알림 Worker 배포와 Secret 등록
- 여러 업무 일괄 AI 추출, 댓글 전용 UI·파일 첨부, 메일 묶음 발송, 멤버 접근 해제 UI는 후속 구현 대상입니다. 현재 상세 설명·수정 이력, 캡처 단일 초안, 관리자 승인 및 최근 발송 상태 조회를 제공합니다.

스키마는 로컬 PostgreSQL 호환 엔진에서 실행·권한·알림 중복 방지·AI 한도를 검증했습니다. 이는 실제 Supabase/Resend/Anthropic Claude 연동 검증을 대신하지 않습니다.

## 추가 검증

`npm run test:db`는 PGlite PostgreSQL 엔진으로 스키마·접근 정책·알림 중복 방지·사용량 한도를 검증합니다. 실제 Supabase는 필요하지 않습니다.

브라우저 검증은 먼저 `npm run start -- --port 3001`로 빌드된 서버를 켠 뒤 `npm run test:browser`를 실행합니다. Chromium이 필요하며 기본 경로는 `/usr/bin/chromium`입니다. 다른 경로는 `CHROMIUM_PATH`로 지정합니다. 스크린샷은 `/tmp/oreum-matrix-*.png`에 저장됩니다.

## 캐릭터 이미지

첨부 스티커 시트의 인사 포즈를 이미지 편집 도구로 투명 배경의 단독 이미지로 추출했습니다. `public/oreum-wave.png`를 랜딩과 사이드바에 사용합니다. 원본의 픽셀 단위 단순 크롭이 아니라 첨부를 바탕으로 편집한 결과입니다.

## 현재 연결 진행 상황

사용자 확인 기준으로 Resend 도메인 `notify.oreumnet.com` 연결 완료, Cloudflare 로그인 완료입니다. 이 환경에서 실제 발송·배포까지 검증한 것은 아닙니다.

AI는 OpenAI 대신 **Anthropic Claude Messages API**를 사용합니다. [Claude Console](https://console.anthropic.com/)에서 API 키를 발급하고 앱 서버의 Secret `ANTHROPIC_API_KEY`에 등록하세요. `ANTHROPIC_MODEL` 기본값은 `claude-haiku-4-5-20251001`이며 프로젝트에서 사용할 수 있는 이미지·도구 호출 지원 모델로 변경할 수 있습니다. Claude 웹 구독과 API 과금은 별도입니다. 키는 채팅이나 GitHub에 넣지 마세요. 캡처와 텍스트는 Anthropic으로 전송되며 최초 업무 초안 확인 후 저장하는 흐름은 동일합니다. 메일 알림 Worker에는 Claude 키가 필요하지 않습니다.

자동 메일 Worker의 `RESEND_FROM`에는 `OREUM <alerts@notify.oreumnet.com>`을 넣으세요. Google 로그인과 실제 동기화에는 별도로 Supabase 프로젝트·SQL 스키마·Google OAuth 설정이 필요합니다.

## 앱 Cloudflare 배포

실제 앱과 알림을 연결하는 최신 단계별 안내는 [CLOUDFLARE-SETUP.md](CLOUDFLARE-SETUP.md)를 따르세요. 앱용 OpenNext Worker와 알림용 일일 Cron Worker를 구분합니다. 이전 Vercel 안내보다 이 Cloudflare 안내를 우선합니다.
