# ADR 0001 — 기존 저장소에서 로컬 MVP 구현

- 승인된 범위: develop에서 새 작업 브랜치로 설계 기반 개발.
- Next.js App Router + NestJS + TypeORM/PostgreSQL + pnpm workspace를 사용한다.
- 기존 Docker PostgreSQL 1992 포트에 전용 `woorisai_lab` 및 `woorisai_lab_test` DB만 추가한다. 다른 DB/컨테이너는 변경하지 않는다.
- Sites 호스팅/Cloudflare로 옮기면 기존 PostgreSQL·NestJS 배포 방식이 달라진다. 이번 작업은 사용자의 기존 GitHub 저장소와 작업 브랜치에서 로컬 앱을 구현하며 새 Site 등록·배포는 하지 않는다.
- Phase 0의 실제 고객 검증은 미수행이다. 개발 요청에 따라 관찰용 MVP를 만들지만 통과 기준을 충족한 것으로 표시하지 않는다.
- 모의 결제는 개발/테스트에서만 허용한다. production에서 mock이면 API 부팅이 실패한다. 실제 PG는 미구현이다.
- Next.js의 CSS와 일반 React 폼을 사용한다. 단순한 단일 선택 설문에 Tailwind/React Hook Form 의존성을 추가하지 않고 Zod로 서버·클라이언트 데이터를 검증한다.
- TypeORM migrations + 매개변수 SQL/트랜잭션을 사용해 행 잠금과 부분 고유 인덱스를 명시한다. synchronize는 비활성화한다.

- Nest의 Express 어댑터에 명시적으로 라우트를 등록하고, 순수 서비스에 DataSource를 전달한다. 로컬 MVP에서는 decorator metadata/DI 복잡성을 줄이면서 HTTP/트랜잭션을 독립 테스트한다. 규모가 커지면 sessions/payments/results 모듈로 분리한다.
- 3000 포트의 기존 Docker 서비스와 충돌을 피하기 위해 개발 웹은 3200을 사용한다. E2E는 3100/4100 및 별도 `.next-e2e` 빌드 경로를 사용한다.
