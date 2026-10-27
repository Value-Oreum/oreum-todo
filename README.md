# What to do for OREUM

오름 팀을 위한 실시간 업무 매트릭스. Next.js + Supabase + Cloudflare Workers.

## 로컬 실행

Node.js 24 이상. 기존 `/workspace/oreum-todo` 체크아웃을 사용하세요. 클라우드 작업은 이미 격리되어 있으므로 별도 worktree는 필요하지 않습니다.

```sh
cd /workspace/oreum-todo
npm --cache /workspace/.npm-cache ci
npm run dev
```

Supabase 공개 설정이 없는 로컬 빌드에서는 랜딩의 **시작하기**가 데모를 엽니다. 실제 배포에서는 같은 버튼이 Google 로그인을 시작합니다. 데모 업무는 해당 브라우저 localStorage에만 저장됩니다. 로그인·팀 동기화·AI·메일은 데모에서 실행되지 않습니다. 데모는 보안 경계를 대체하지 않으며 실제 DB 권한은 RLS로 별도 보호됩니다.

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

중요도는 1~5점이며 3 이상이 중요한 영역입니다. 가로축 진행상황은 원활·유지·지연·막힘·미해결입니다. 긴급도와 난이도는 기존 기록으로 보존합니다. 최초 기준값은 DB에서 고정하고 변경 사유를 남깁니다. 클라이언트가 히스토리를 조작해도 서버가 다시 생성하며 `task_events`에 변경 전후 전체 데이터를 추가 기록합니다. 일반 멤버는 아카이브를 수정·삭제할 수 없습니다. 중요도 1~2점이면서 지연·막힘·미해결이고 14일 이상 변경이 없는 업무에만 지속 여부 검토 표시가 나옵니다. 드롭은 사용자가 결정합니다.

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

## 매트릭스 화면과 프로젝트 흐름

- Pretendard Variable을 npm 패키지로 포함해 자체 제공하며 외부 폰트 CDN에 의존하지 않습니다.
- 전체 매트릭스는 100dvh 레이아웃 안에서 유지됩니다. 가로축 X는 진행상황(원활→유지→지연→막힘→미해결), 세로축 Y는 중요도입니다. 중요도 3~5점과 지연·막힘·미해결의 교차 영역이 집중 관리 대상입니다. 같은 좌표의 업무는 수량 배지로 묶고 선택 목록을 엽니다. 긴 제목은 일부 생략되므로 노드를 눌러 전체 내용을 확인하세요.
- 업무 등록은 상단 버튼에서 수행하며 사분면 안의 등록 버튼은 제거했습니다. 고객사/프로젝트 입력은 기존 저장값 자동완성을 제공하고 공백·대소문자 차이는 같은 프로젝트로 정리합니다. 완료한 업무도 프로젝트 흐름에 남고 휴지통 업무는 흐름에서 제외합니다. 휴지통 기록의 프로젝트명은 자동완성에 유지합니다.
- 프로젝트 흐름은 같은 고객사/프로젝트의 업무들을 최초 등록 순으로 연결한 시각화입니다. 업무 사이의 의존 관계를 자동 추론하는 그래프는 아닙니다. DB 스키마 변경 없이 저장된 업무와 히스토리로 구성합니다.
- 신규 업무 담당자는 동수(eastsea.chae@gmail.com), 형원(echa.value@gmail.com) 두 명입니다. 기존의 다른 계정 담당 업무는 임의로 재배정하지 않습니다. 담당자는 서버에서 승인된 멤버여야 하므로 형원 계정도 최초 로그인·승인 상태 확인이 필요합니다.
- 랜딩은 오름 캐릭터, 서비스 제목, 시작하기 버튼으로 구성하며 둥실 움직임과 기울임 애니메이션을 적용합니다. prefers-reduced-motion 환경에서는 애니메이션을 끕니다.
- 브라우저 테스트는 1366×768, 1280×720, 1920×1080, 390×844, 375×667, 360×640에서 매트릭스 전체가 화면 안에 들어오는지 검사합니다.

## 매트릭스 가독성 보완

상단의 중복 경로 표시를 제거하고 제목·등록·필터를 작게 묶어 좌측 메뉴를 유지한 채 매트릭스 높이를 확보했습니다. 1–2/3–5 범례는 하단 상태줄로 이동했습니다. 사분면 설명과 업무명이 겹치지 않도록 설명 영역을 확보하고, 업무명은 같은 사분면 안의 빈 공간에 배치해 실제 점수 위치와 선으로 연결합니다. 위치는 중요도와 진행상황으로 정하며, 밀집해 제목을 넣을 공간이 없으면 점을 클릭해 업무를 엽니다. 업무 25개가 모두 다른 좌표에 놓인 모바일 사례를 포함해 겹침과 접근성을 검증합니다.

사용자가 승인한 기준은 중요도 × 진행상황입니다. 사업 영향도·대응 시급성 안 대신 이 기준을 사용합니다.

## 진행상황과 집중 관리

- 원활: 계획대로 진행. 유지: 합의된 일정에 따라 확인 중. 지연: 약속한 일정이 지나 후속 조치 필요. 막힘: 결정·지원·외부 조치 없이는 진행 곤란. 미해결: 조치 후에도 문제가 남고 해결 방향 재검토 필요. 이 순서는 관리 필요도를 나타내며 모든 업무가 차례대로 거쳐야 하는 절차는 아닙니다.
- 집중 관리 기준은 **중요도 3~5 + 진행상황 지연/막힘/미해결 + 미완료**입니다. 완료·드롭·휴지통은 제외합니다. 우상단의 영역 설명에서 기준을 확인하고 상단 필터로 모아볼 수 있습니다. 해당 업무는 지속적인 색 테두리와 3초 주기의 점 주변 링으로 강조합니다. 움직임 감소 설정에서는 정적인 강조로 전환합니다.
- 기존 업무는 긴급도를 진행상황으로 자동 환산하지 않습니다. 진행상황 미분류 점과 `미분류 N · 설정하기` 목록에서 업무를 열어 진행상황·처리 유형을 선택합니다. 긴급도·난이도 및 최초 점수는 읽기 전용 기존 기록에 남습니다.
- 처리 유형은 바로 처리/추적 관리입니다. 추적 관리는 다음 확인일을 입력하며 이 날짜를 기존 reminder_at 필드에 보관합니다. 메일을 꺼도 확인일을 저장할 수 있고, 켜면 기존 일일 무료 알림에 연결합니다. 반복 알림은 기존 DB 예약 로직이 다음 확인일을 갱신합니다. 예정된 회신을 기다리는 경우 진행상황은 `유지`일 수 있습니다.
- 새 필드는 tasks.data JSON에 저장합니다. 기존 SQL을 다시 실행하거나 데이터 마이그레이션할 필요가 없습니다. 상세 히스토리는 기존의 불변 task_events 변경 전후 스냅샷에서 진행상황·처리 유형·확인일 차이를 읽어 표시합니다. 기존 DB 트리거가 일반적인 수정 문구를 생성해도 상세 차이는 보존됩니다. 최신 500개 이벤트를 상세 복원하고 이전 기록은 저장된 타임라인을 함께 표시합니다.
- 중요도 또는 이미 분류된 진행상황을 바꾸면 사유가 필요합니다. 첫 미분류 업무를 분류할 때는 사유 입력 없이 선택할 수 있습니다. 처리 유형·확인일 변경도 자동 기록합니다. 예상 투입시간은 선택 정보이며 좌표에 영향을 주지 않습니다.
- Claude는 중요도·진행상황·처리 유형 초안을 제안합니다. 근거가 없는 진행상황은 `확인 필요`로 반환해 직접 선택하게 하고, 확인일을 추측하지 않습니다. 실제 Claude/Resend 호출은 별도 서비스 연결 상태에 따라 검증해야 합니다.
