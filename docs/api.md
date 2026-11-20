# 로컬 API 계약

기본 경로 `/api/v1`. 모든 개인 요청은 브라우저의 `woorisai_<session UUID>` HttpOnly 쿠키가 필요하다. 상태 변경은 `Origin: http://127.0.0.1:3200`, `X-Woorisai-Request: 1`, JSON 본문을 요구한다. 웹은 동일 사이트 rewrite를 통해 접근한다. 실제 토큰을 코드·URL·문서에 붙여넣지 않는다.

| 메서드 | 경로 | 입력/조건 | 결과 |
|---|---|---|---|
| GET | `/health` | 공개 | DB 연결·mock 상태 |
| GET | `/surveys/current` | 공개 | 버전·12문항 |
| GET | `/samples/0`~`/samples/2` | 공개, 가상 데이터만 | 무료/유료 완성 예시 |
| POST | `/sessions` | nickname, adult=true, consent=true | 201, sessionId·쿠키 |
| GET | `/sessions/:id` | 개인 쿠키 | 본인 답변·상대 참가 여부·상태·구매 여부 |
| PUT | `/sessions/:id/answers` | surveyVersion, answers[{questionId,value}] | 부분 upsert, 중복/미정의 문항 거부 |
| POST | `/sessions/:id/submit` | 12개 응답 | 제출 확정, 재시도 멱등 |
| GET | `/sessions/:id/my-result` | 본인 제출 | 본인 선택 요약 |
| POST | `/sessions/:id/invite/rotate` | A 제출·B 미참가 | 이전 초대 폐기·새 초대 URL |
| GET | `/invites/:token/preview` | 유효 초대 | canJoin만, 슬롯 미점유 |
| POST | `/sessions/:id/join` | invite + nickname/adult/consent | 201, B 쿠키, 동시 참가 1명 |
| GET | `/sessions/:id/pair-result` | 두 사람 제출 | 12문항 비교·질문 2개, 유료 원문 제외 |
| POST | `/sessions/:id/orders` | 두 사람 제출·구매 이력 없음 | 3,900원 mock 주문, 보류 주문 재사용 |
| GET | `/orders/:id` | 해당 세션 쿠키 | 서버 주문 상태 |
| POST | `/payments/confirm` | orderId만 | mock ledger 검증, 상태/권한 동기화 |
| POST | `/payments/mock/:orderId` | 해당 세션 쿠키·개발 모드 | outcome: PENDING/PAID/FAILED/CANCELED/REFUNDED |
| POST | `/payments/webhook/mock` | 서명·5분 시간창 | 거래 재검증·중복 이벤트 무시 |
| GET | `/sessions/:id/premium-report` | ACTIVE 권한 | 카드 5개·질문 10개·고정 콘텐츠 버전 |
| PUT | `/sessions/:id/feedback` | 해당 scope 열람·본인, premium은 권한 | scope, usedForConversation, helpful; 갱신 upsert |
| POST | `/sessions/:id/delete` | 본인, confirm=DELETE_PAIR | 두 사람 데이터 삭제·접근 철회 |
| POST | `/analytics/events` | 허용 공개 이벤트만 | 허용되지 않은 속성/금액/답변/토큰 거부 |

에러는 `{code,message,requestId}`. 주요 상태는 400 입력, 401 참여자/웹훅 인증, 403 CSRF/유료 권한, 404 삭제/없는 리소스, 409 순서·경합·확정 상태, 410 만료, 429 요청 제한이다.

## 모의 웹훅

`X-Mock-Timestamp`는 현재 밀리초 시간 문자열, `X-Mock-Signature`는 `timestamp + '.' + rawBody`를 로컬 토큰 해시 키로 HMAC-SHA256 처리한 hex다. 본문은 `{orderId}`만 받으며 본문에서 성공·금액을 받아들이지 않는다. 이 계약은 로컬 모의 전용이며 실제 PG 사양을 의미하지 않는다. production에서 mock 모드는 시작부터 거부한다.

## 삭제와 거래 기록

삭제 시 응답·닉네임·참여자 토큰·초대 토큰·결과·개인 피드백·세션 이벤트를 지우고 유료 권한을 철회한다. 모의 거래 기록의 구매자 연결은 끊고 거래 감사 자료만 분리 유지한다. 실제 서비스의 보존·환불 의무와 권리 처리는 출시 전 확정한다.
