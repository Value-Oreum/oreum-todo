# Cloudflare에 연결하기

사용자 확인: Supabase 프로젝트 생성·SQL 실행·Google 로그인 설정 완료, Resend 도메인 인증 완료, Cloudflare 로그인 완료.
프로젝트 URL: `https://cvmmxhnoyhnybiniiedc.supabase.co`.

아직 이 실행 환경에는 Cloudflare 인증이나 실제 API 키가 없으므로 여기서 실제 서비스 배포와 계정 간 동기화·메일·AI를 검증하지 않았습니다. 아래는 배포할 두 Worker의 설정입니다. **Cloudflare Pages가 아닌 Workers**를 선택하세요. Next.js 서버 API를 OpenNext로 실행합니다.

## 1. 앱 Worker: oreum-workspace

Cloudflare → Workers & Pages → Create → Workers → Import a repository에서 GitHub의 `Value-Oreum/oreum-todo`를 선택합니다. GitHub에 앱 소스가 올라온 뒤 진행합니다.

- Build command: `npm run build:cloudflare`
- Deploy command: `npm run deploy:cloudflare`
- Root directory: 저장소 루트
- Node.js: 24
- 설정 파일: 루트 `wrangler.jsonc` (알림용 `cloudflare/wrangler.jsonc`와 다름)

**첫 빌드 전에 Build variables에 추가**:

| 이름                            | 값                                         |
| ------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://cvmmxhnoyhnybiniiedc.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase의 클라이언트용 anon 키            |

이 두 값은 브라우저 코드에 들어가는 공개 설정입니다. anon 키 대신 service_role 키를 넣으면 안 됩니다. 키를 추가·변경하면 재빌드가 필요합니다. 빌드 전 확인 스크립트가 누락을 감지하면 배포 빌드는 실패하도록 했습니다.

배포 후 앱 Worker → Settings → Variables and Secrets에도 다음을 등록합니다:

| 이름                        | 종류   | 값                                                      |
| --------------------------- | ------ | ------------------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase 서버 전용 service_role 키                      |
| `ANTHROPIC_API_KEY`         | Secret | Claude API 키                                           |
| `ANTHROPIC_MODEL`           | Text   | `claude-haiku-4-5-20251001`                             |
| `NEXT_PUBLIC_APP_URL`       | Text   | 실제 배포된 `https://oreum-workspace.…workers.dev` 주소 |

`NEXT_PUBLIC_SUPABASE_URL`은 wrangler 설정에 이미 반영했습니다. 실제 데이터 권한은 Supabase RLS로 보호합니다. 본문·캐릭터는 정적 자산으로 배포하고 별도 R2·이미지 변환 유료 바인딩은 사용하지 않습니다. 유료 플랜 전환을 자동으로 요청하지 않습니다. 계정의 무료 요청·CPU 한도는 운영 부하에서 별도 확인해야 합니다.

## 2. Google 로그인 주소 수정

Supabase Authentication → URL Configuration:

- Site URL: 실제 앱 주소
- Redirect URLs: 실제 앱 주소 `/` 허용

Google Cloud OAuth 앱의 Authorized redirect URIs에는 Supabase Google provider 화면의 callback URL을 사용합니다. 현재 프로젝트의 일반적인 형식은 `https://cvmmxhnoyhnybiniiedc.supabase.co/auth/v1/callback`이며 Supabase 화면의 값을 확인하세요.

관리자 계정으로 로그인해 매트릭스가 열리는지 확인합니다. 앱이 데모 상태로만 보이면 Build variables를 확인하고 재빌드하세요.

## 3. 알림 Worker: oreum-daily-reminders

별도의 Workers 프로젝트에서 같은 GitHub 저장소를 선택합니다.

- Build command: `npm ci`
- Deploy command: `npx wrangler deploy --config cloudflare/wrangler.jsonc`
- Root directory: 저장소 루트

알림 Worker → Settings → Variables and Secrets:

| 이름                        | 종류   | 값                            |
| --------------------------- | ------ | ----------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase 서버 전용 키         |
| `RESEND_API_KEY`            | Secret | Resend 발송용 키              |
| `APP_URL`                   | Text   | 1단계에서 배포한 실제 앱 주소 |

`SUPABASE_URL`과 `RESEND_FROM=OREUM <alerts@notify.oreumnet.com>`은 설정 파일에 반영했습니다. Secret을 넣은 뒤 적용합니다. Cron은 매일 UTC 00:00, 한국 오전 9시입니다. 하루 최대 5건, 초과분은 다음 실행에서 처리합니다. 키 설정 전 실행은 실패하며 메일을 보내지 않습니다. 이 Worker에는 Claude 키를 넣지 않습니다.

## 4. 연결 확인

- 관리자와 다른 멤버가 각각 로그인하고 업무 변경이 양쪽에 반영되는지 확인
- 비승인 계정은 승인 대기 화면인지 확인
- 캡처 분석이 초안을 만들고, 확인·저장 후 히스토리에 남는지 확인
- 시험 업무에 알림을 등록하고 다음 일일 실행의 Worker Logs·reminder_jobs·실제 받은 메일을 확인

API 키를 채팅·GitHub 파일·빌드 명령에 넣지 마세요. 앱 서버용 Secret과 알림 Worker용 Secret은 서로 별도로 등록합니다. DNS 인증 완료만으로 실제 발송 검증이 끝난 것은 아닙니다.
