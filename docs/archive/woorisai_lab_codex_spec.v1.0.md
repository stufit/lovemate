# 우리사이 연구소 (Woorisai Lab) — Codex 개발 설계서

> **문서 버전:** v1.0 · **작성일:** 2026-11-20 · **상태:** MVP 구현용 명세
>
> **제품 한 문장:** 두 사람이 각자 12개의 관계 소통 질문에 답하고, 무료로 기본 비교 결과를 확인한 뒤 3,900원을 결제하면 실제 응답 차이를 바탕으로 한 심층 대화 리포트를 함께 열람하는 모바일 우선 웹서비스.
>
> **중요:** 이것은 심리진단·상대방 마음 읽기·관계 지속 확률 예측 서비스가 아니다. 사용자 응답을 바탕으로 성향을 설명하는 **자기성찰·대화 촉진용 콘텐츠**다.

---

## 0. Codex 작업 시작 안내

### 구현 원칙

- **작동하는 MVP를 우선 구현한다.** 과도한 관리자 시스템, 구독, 소셜 로그인, 3D 그래픽, 다국어, 친구 추천 보상은 v1 범위 밖이다.
- 기능별로 작은 PR을 만들고 테스트·문서·DB 마이그레이션을 함께 업데이트한다.
- 실제 외부 연동이 필요한 부분은 `mock` 어댑터로 먼저 개발하되, **mock과 실결제/실배포를 혼동하지 않게 환경별로 강제 분리**한다.
- **무료 결과는 완결된 가치를 제공**해야 한다. 결제 전 불안을 조장하거나 결과를 의도적으로 왜곡하지 않는다.
- 결제 검증은 클라이언트 콜백만 믿지 않고 반드시 서버에서 확인한다.
- LLM이 사용자의 성향 점수를 결정하게 하지 않는다. 점수는 버전이 고정된 룰 엔진에서 계산하고, LLM은 선택적으로 설명문을 생성한다.

### Codex 첫 작업 지시문 (복사해서 사용)

```text
이 저장소의 `docs/woorisai_lab_codex_spec.md`를 먼저 읽고, 우리사이 연구소 MVP를 단계적으로 구현해줘.
1. 기존 프로젝트가 있으면 현재 구조를 분석하고 기술 스택을 존중해. 빈 저장소면 본 설계서의 제안 스택으로 구성해.
2. 먼저 구현 계획/작업 체크리스트와 전체 디렉터리 구조를 제안한 다음 Phase 1(프로젝트 구성, DB, 설문 seed, 로컬 실행, 기본 테스트)부터 구현해.
3. 모든 핵심 도메인 로직은 테스트 우선 또는 테스트와 함께 작성해. 외부 API, 결제, 메일은 로컬 mock 제공.
4. 비밀 키는 코드를 작성하거나 커밋하지 마. `.env.example`만 생성해.
5. 각 단계 완료 시 실행 명령, 추가된 파일, 테스트 결과, 남은 TODO를 요약해.
6. 설계서와 다른 결정을 내리면 이유와 대안을 ADR에 기록해.
```

---

## 1. 프로젝트 개요

| 항목 | 정의 |
|---|---|
| 서비스명(가칭) | 우리사이 연구소 |
| 핵심 타깃 | 한국어 사용 20~30대 성인 연인·예비부부·신혼부부 |
| 핵심 문제 | 함께 대화하고 싶지만 무엇을 어떻게 말해야 할지 모름 |
| 핵심 경험 | 1인이 방을 만들고, 상대를 초대해, 각각 12문항에 응답하고 결과를 함께 확인 |
| 무료 기능 | 개인 성향 결과 + 2인 기본 비교 결과 + 공유 카드 |
| 유료 기능 | **커플 심층 리포트 1건 / 3,900원**, 두 사람 모두 열람 |
| 핵심 차별점 | AI가 임의로 궁합을 판정하는 서비스가 아닌 **서로의 응답 차이**를 보여주는 공동 참여형 경험 |
| 출시 채널 | 모바일 웹 (반응형 데스크톱), 한국어 |
| 가입 | MVP는 회원가입 없음, 참여 링크 + 개인 액세스 토큰 |
| 결제 | 국내 PG 연동을 위한 어댑터. 공급사·수수료·심사 조건은 도입 시 확인 |
| 북극성 지표 | `completed_pair_sessions` (두 사람 모두 응답 완료한 세션 수) |

### 사업 가설

1. 설문 12문항은 모바일에서 완료하기 충분히 짧다.
2. 각자의 답변을 교차 비교하는 기능이 친구/연인 간 초대 동기를 만든다.
3. 무료 비교 결과만으로도 만족감을 제공할 수 있고, 일부 사용자는 3,900원 심층 리포트를 선택할 것이다.
4. 유료 전환율보다 **2인 완료율**이 초기 제품의 병목일 수 있다.

이 가설은 **미검증**이며 실제 사용자 행동으로 검증한다.

### 첫 검증 목표 (사업 예측이 아닌 실험 기준)

- 유효 랜딩 방문자 300명 이상 확보.
- 방문자 → 첫 설문 시작률, 첫 설문 완료율, 상대 초대율, 2인 완료율, 무료 결과 열람률, 유료 결제율 측정.
- 첫 유료 결제 3건을 초기 **결제 의향 신호**로 본다. 유료 전환율의 통계적 확정으로 해석하지 않는다.
- 유료로 전환되지 않는 경우에도 `방문 → 시작 → 본인 완료 → 상대 완료 → 결과 → 결제` 퍼널에서 원인을 찾는다.

---

## 2. MVP 범위

### 포함 (P0)

- [ ] 서비스 소개 랜딩 페이지 및 시작 CTA
- [ ] 커플 세션 생성 / 임의의 비추측성 초대 URL 발급
- [ ] 본인·상대 각각 닉네임 입력 및 12문항 개별 응답
- [ ] 설문 중 임시저장, 새로고침 복구 (개인 세션 접근 토큰 기반)
- [ ] 본인 제출 후 `상대 기다리는 중` 화면과 공유 기능
- [ ] 양쪽 제출 후 확정된 규칙 기반 점수 산출
- [ ] 무료 개인 결과 + 무료 커플 비교 결과
- [ ] 기본 공유 카드 (상대의 민감한 개별 응답·유료 내용 비노출)
- [ ] 3,900원 심층 리포트 구매 및 구매 상태 확인
- [ ] 결제 성공 시 두 참여자에게 동일 구매 결과 접근 제공
- [ ] 주문 조회, 취소/환불 요청 동선, 오류/재시도 안내
- [ ] 개인정보·이용약관·콘텐츠 한계 고지·고객지원 페이지
- [ ] 익명/가명 이벤트 추적, 오류 로깅, 운영자가 사용할 기본 지표 쿼리
- [ ] 결과 재현성·참여자 권한·결제 중복 방지 테스트

### 제외 (P1/P2)

- 회원가입, 카카오/네이버 소셜 로그인, 앱 설치, 푸시 알림, 구독 과금
- 궁합 점수를 절대적인 성격·관계 진단으로 표시하는 기능
- 답변별 자동 채팅상담, AI가 상대의 속마음을 추측하는 기능
- SNS 피드, 커뮤니티, 매칭/소개팅, 실시간 채팅
- 여러 주제 유료 패키지, 커플 월간 리포트, 관리자 대시보드 풀스택
- 개인 사진 업로드, 음성 인식, 위치 수집
- 대규모 A/B 플랫폼 및 정교한 CRM 자동화

---

## 3. 사용자 여정 / 상태 다이어그램

### 핵심 플로우

```mermaid
flowchart TD
    A[랜딩] --> B[테스트 시작]
    B --> C[커플 세션 생성]
    C --> D[참여자 A 닉네임 입력]
    D --> E[A 12문항 응답]
    E --> F[A 결과 및 초대 링크]
    F --> G[상대 B 입장]
    G --> H[B 닉네임 및 12문항]
    H --> I[응답 완료 · 결과 생성]
    I --> J[무료 비교 결과]
    J --> K{심층 리포트 구매?}
    K -->|아니요| L[공유 및 종료]
    K -->|예| M[주문 생성 · 결제 진행]
    M --> N{서버 결제 확인}
    N -->|성공| O[두 참여자 유료 리포트 열람]
    N -->|실패/취소| J
    O --> L
```

### 세션 상태

- `WAITING_FOR_FIRST`: 생성, 아직 첫 제출 없음
- `WAITING_FOR_PARTNER`: 첫 제출 완료, 상대 미완료
- `PAIR_COMPLETED`: 두 사람 모두 제출했고 무료 결과 생성됨
- `EXPIRED`: 미완료 세션 만료
- `DELETED`: 삭제 요청 또는 보관기간 종료

**주의:** 결제 상태는 세션 상태와 별도인 `orders`/`entitlements`로 관리한다. 결제 실패가 설문 결과를 소실시키면 안 된다.

### 이용자 시나리오

1. A가 익명으로 테스트 시작, 닉네임은 `민지`로 설정.
2. A는 12문항을 완료하고 자기 결과 및 초대 링크를 받음.
3. B가 링크에 접속하면 참여자 B 슬롯을 **원자적으로 점유**하고 닉네임 입력 후 설문 진행.
4. A/B 모두 완료되면 동일 무료 비교 결과를 볼 수 있음.
5. A가 심층 리포트를 결제하면 A/B 모두 별도 재구매 없이 열람 가능.
6. 공유 카드에는 공통 유형명 등 안전한 요약만 포함하고, 원문 답변은 공개하지 않음.

### 동시성 / 오류 경계

- 같은 초대 URL에 제3자가 들어오면 B 슬롯 선점 경합이 발생할 수 있다. **DB 트랜잭션 + 고유 제약**으로 1명만 수락되도록 한다.
- 초대 URL은 아직 B 슬롯이 비어있을 때에만 유효하고, 서버가 만료/폐기할 수 있어야 한다.
- A/B 참여자 토큰은 서로 공유되지 않는다. 결과는 **두 사람의 제출 완료 이후**에만 제공한다.
- A나 B가 실수로 브라우저를 닫아도 자신만의 토큰으로 재진입할 수 있게 한다. 브라우저 데이터 삭제 시 계정 없는 복구는 보장하지 않는다.
- 중복 제출·중복 웹훅·결제 승인 콜백 재전송은 멱등적으로 처리한다.

---

## 4. 설문·성향 모델

### 제품 문구 원칙

- `커플 궁합 87점 = 결혼 가능성 87%`와 같은 허위 확률 표현 금지.
- `당신의 응답에 따르면`, `두 사람이 이 문항에서 다르게 답했어요`처럼 **관찰 가능한 사실**을 말한다.
- 점수는 검사 타당도가 검증된 심리 측정치가 아닌 **서비스 내 비교 지표**라고 표시한다.
- 우울·폭력·자해 등 고위험 문제에 대해 자동 진단·판단·치료 조언을 하지 않는다.

### 4개 축 (각 3문항)

1. `EMOTION`: 갈등 시 감정 표현과 공감 선호
2. `RESOLUTION`: 문제 해결과 대화 시점 선호
3. `AFFECTION`: 애정 표현 및 확인 방식 선호
4. `SPACE`: 개인 시간과 경계 존중 선호

질문은 특정 답변이 '더 좋은 사람'으로 해석되지 않도록 양방향 선호로 설계한다. **초기에는 성격 유형 16종 같은 복잡한 라벨링을 만들지 않는다.**

### 샘플 문항 (총 12개, MVP seed 초안)

| ID | 축 | 질문 | 낮은 점수(1) | 높은 점수(5) |
|---|---|---|---|---|
| Q01 | EMOTION | 속상한 일이 생기면 내 감정을 바로 말하는 편이다. | 시간을 두고 말함 | 바로 말함 |
| Q02 | EMOTION | 상대가 힘들어하면 해결책보다 공감을 먼저 전하고 싶다. | 해결책 먼저 | 공감 먼저 |
| Q03 | EMOTION | 갈등이 생겼을 때 표정이나 감정 표현이 비교적 드러난다. | 잘 드러나지 않음 | 바로 드러남 |
| Q04 | RESOLUTION | 다툰 뒤에는 가능한 한 그날 대화를 마무리하고 싶다. | 충분한 시간 필요 | 당일 정리 선호 |
| Q05 | RESOLUTION | 의견 차이가 나면 구체적인 해결안을 정하는 것이 마음 편하다. | 과정과 감정 중시 | 해결안 중시 |
| Q06 | RESOLUTION | 서운한 점은 돌려 말하기보다 직접 말하는 편이다. | 우회적으로 표현 | 직접 표현 |
| Q07 | AFFECTION | 애정 표현은 말로 자주 확인하는 게 중요하다. | 행동으로 충분 | 말로 확인 중요 |
| Q08 | AFFECTION | 함께 계획한 특별한 시간을 보내는 것이 사랑을 느끼는 데 중요하다. | 일상 속 함께 있음 | 특별한 시간 중요 |
| Q09 | AFFECTION | 상대가 내 작은 변화나 취향을 알아봐 줄 때 애정을 크게 느낀다. | 크게 영향 없음 | 매우 중요 |
| Q10 | SPACE | 혼자만의 시간을 정기적으로 확보하는 게 중요하다. | 함께하는 시간 우선 | 개인 시간 중요 |
| Q11 | SPACE | 서로의 휴대전화·메시지는 각자의 사생활로 존중해야 한다고 생각한다. | 공유를 편하게 여김 | 독립적 경계 중시 |
| Q12 | SPACE | 연애 중에도 개인적인 친구 관계와 취미 시간을 유지하고 싶다. | 연인과 함께하는 편 | 개인 활동 유지 선호 |

**응답 척도:** 1~5 리커트, `전혀 아니다 / 아니다 / 보통이다 / 그렇다 / 매우 그렇다`.

**필수 제품 검토:** 문항이 하나의 타당한 심리척도를 구성하는지 검증되지 않았으므로 축 이름과 설명은 임의의 심리진단처럼 보이지 않게 한다. `SPACE`의 Q11은 프라이버시 가치관을 묻는 문항이지 기기 접근 허용을 권유하는 문항이 아니다.

### 점수 로직 v1.0 (결정적·순수 함수)

```ts
type Dimension = 'EMOTION' | 'RESOLUTION' | 'AFFECTION' | 'SPACE';
type ResponseMap = Record<string, 1 | 2 | 3 | 4 | 5>;

// 각 축은 정확히 3문항, 모든 문항 응답 필수.
// personDimensionScore = 해당 축 3문항의 평균값 (1.00 ~ 5.00)
// pairDifference = |A 평균 - B 평균| (0.00 ~ 4.00)
// pairAlignment = round(100 * (1 - pairDifference / 4)) // 0~100
// overallAlignment = round(네 축 alignment 산술 평균)
```

- 내부 계산은 부동소수 오차를 줄이기 위해 3문항의 정수 합을 우선 사용한다.
- 개별 답변 차이 `abs(A[q] - B[q])`가 큰 문항 5개를 상세 리포트 후보로 선택한다. 동률이면 문항 ID 오름차순.
- `pairAlignment`는 서로의 **응답 유사도**이며 관계 성공률이나 우수성 점수가 아니다. UI 명칭은 `답변 유사도`로 사용한다.
- 전체 점수에 기반한 좋음/나쁨 등급은 제공하지 않는다.
- 입력 질문·점수 알고리즘·문구 템플릿에 `surveyVersion`과 `algorithmVersion`을 저장하고, 이미 생성된 결과가 재계산으로 변하지 않도록 스냅샷 저장한다.

### 결과 설명 템플릿 예시

- `EMOTION 차이 작음`: "두 분은 감정을 표현하는 타이밍에 비슷하게 답했어요."
- `EMOTION 차이 큼`: "한 분은 바로 표현하는 편이고 다른 분은 시간을 두는 편이에요. 갈등이 없을 때 대화 방식부터 정해보세요."
- `SPACE 차이 큼`: "혼자만의 시간이 필요한 정도가 다를 수 있어요. 개인 시간을 미리 합의해보면 어떨까요?"
- `응답 유사도`의 의미를 설명하고, **차이가 클수록 나쁜 관계**로 해석하지 않는다.

### LLM 사용 (옵션)

- **MVP 기본값:** 결정적 템플릿 기반 설명. LLM 없이도 모든 무료/유료 기능이 작동해야 한다.
- 필요하면 `ReportNarrativeGenerator` 인터페이스에 `TemplateGenerator`와 `LLMGenerator`를 구현한다.
- 프롬프트에는 닉네임·원문 답변 대신 최소한의 축별 요약 데이터만 전송하는 것을 기본으로 한다.
- LLM 응답은 JSON 스키마 검증과 문장 길이 제한을 적용하고, 실패하면 정적 템플릿으로 대체한다.
- 미확인 주장을 덧붙이거나 관계를 단정하는 문구는 사용하지 않는다.

---

## 5. 무료 / 유료 기능 상세

| 항목 | 무료 | 유료 (3,900원/커플 세션) |
|---|---|---|
| 개인 답변 성향 | 4축 요약 | 동일 |
| 커플 4축 비교 | 기본 바 차트, 축별 1문장 | 상세 설명과 추천 대화법 |
| 공통점·차이 | 공통점 3가지와 차이 2가지 | 답변 차이 TOP 5 문항 상세 분석 |
| 대화 가이드 | 시작 질문 2개 | 맞춤 대화 질문 10개 및 대화 예시 |
| 공유 | 공개 안전 요약 이미지 | 두 사람 비공개 상세 리포트 링크 |
| 내보내기 | 무료 카드 이미지 | 인쇄·PDF 저장 (브라우저 인쇄형 PDF부터 구현) |
| 접근 범위 | 참가자 각각 자신의 토큰으로 접근 | 하나만 결제해도 A와 B 모두 접근 |

### 결제 유도 문구 (권장)

- 권장: "서로 다른 답변 5개를 살펴보고, 이야기 나눌 질문 10개를 받아보세요."
- 금지: "둘의 관계가 위험합니다. 3,900원을 내야 진실을 볼 수 있습니다."
- 결제 전 샘플 미리보기, 총 결제금액, 환불/이용조건을 명확히 제공한다.

### 구매 정책

- `productCode = PAIR_DEEP_REPORT_V1`, `priceKRW = 3900`.
- 커플 세션당 동일 제품은 1회 결제만 허용, 영구 중복 구매 방지.
- 환불 정책은 국내 적용 법규, PG 계약, 디지털 콘텐츠 제공 시점에 맞춰 법률 검토 후 확정. 이용자의 법정 권리를 일률적으로 배제하지 않는다.
- 환불/취소 시 유료 접근 권한 처리는 환불 조건과 실제 콘텐츠 제공 여부에 따라 정책화하며, 감사 로그를 남긴다.

---

## 6. 정보 구조 / 화면 명세

### 경로 설계

| Route | 화면 | 인증/권한 | 주요 동작 |
|---|---|---|---|
| `/` | 랜딩 | 공개 | 시작 버튼, 예시 리포트, 가격, FAQ |
| `/start` | 커플 세션 생성 | 공개 | 동의, 방 생성, 내 액세스 토큰 발급 |
| `/s/[sessionId]/join?invite=...` | 상대 참가 | 유효 초대 토큰 | B 슬롯 점유, B 액세스 토큰 발급 |
| `/s/[sessionId]/survey` | 설문 | 개인 토큰 | 응답 저장, 완료 제출 |
| `/s/[sessionId]/waiting` | 상대 기다림 | 개인 토큰 | 초대 링크 복사, 상태 확인 |
| `/s/[sessionId]/result` | 무료 커플 결과 | 개인 토큰 + 2인 완료 | 무료 비교, 결제 CTA |
| `/s/[sessionId]/report` | 심층 리포트 | 개인 토큰 + entitlement | 심층 결과, PDF 인쇄 |
| `/s/[sessionId]/checkout` | 결제 시작 | 개인 토큰 + 2인 완료 | 주문 생성, 결제 요청 |
| `/payment/return` | 결제 복귀 | 주문 검증 | 서버 승인 결과 조회 |
| `/terms`, `/privacy`, `/refund`, `/support` | 법적/고객지원 | 공개 | 필수 안내 및 문의 |

### 모바일 UX 요구사항

- 첫 화면 상단에서 **15초 내** 서비스 가치와 `무료로 시작` 버튼을 이해할 수 있어야 한다.
- 설문은 1문항/화면, 현재 진행률, 뒤로 가기, 선택 즉시 다음으로 진행(선택 가능), 제출 전 수정 가능.
- 링크 공유는 Web Share API 사용 가능 시 우선, 아니면 복사 버튼.
- 페이지 새로고침, 네트워크 실패 후 자동 재시도, 만료된 링크 화면 등을 디자인에 포함.
- 결과는 숫자 경쟁보다 **서로의 표현 방식이 다를 수 있다**는 설명에 초점.
- 접근성: 터치 영역 ≥44px, 명확한 포커스, 키보드 동작, 색에만 의존하지 않는 차트, 화면 낭독 레이블.
- OG 공유 카드에는 닉네임/상세 답변이 기본적으로 들어가지 않도록 한다.

### 핵심 화면별 완료 기준

**랜딩:** 서비스 내용, 무료 범위, 3,900원 가격, 익명 사용, 한계 고지, FAQ가 보임.

**설문:** 12개 응답 없이는 제출 불가. 새로고침 후 같은 참여자의 임시 응답만 복구됨.

**대기:** 상대 완료 여부만 노출, 상대의 미완료 개별 응답은 보이지 않음.

**무료 결과:** 두 사람 완료 상태에서만 열람 가능. 공통점·차이점과 데이터 근거가 일치함.

**결제:** 중복 주문과 결제 성공/실패/취소/보류의 UX가 명확함.

**유료 결과:** 구매 검증 없이 URL 직접 호출로 접근 불가. A/B 모두 접근 가능.

---

## 7. 권장 기술 아키텍처

사용자가 익숙한 스택을 활용하는 안이며, 빈 저장소를 기준으로 작성했다. **초기 배포 효율을 위해 모노레포를 권장**한다.

### 구성

- **Frontend:** Next.js (App Router), TypeScript, Tailwind CSS, React Hook Form, Zod
- **Backend:** NestJS, TypeScript, REST, class-validator 또는 Zod 중 하나로 통일
- **Database:** PostgreSQL, TypeORM (사용 경험 활용), migrations 필수
- **Cache/Queue:** MVP에서는 Redis/BullMQ 불필요. 나중에 이메일/비동기 작업 증가 시 도입
- **Analytics:** 개인정보 최소화된 이벤트 수집 (자체 events 테이블 또는 별도 도구)
- **Testing:** Vitest/Jest (프로젝트에 맞춰 통일), Supertest, Playwright E2E
- **Infra:** Docker Compose(local: web/api/postgres), HTTPS 배포, 기본 모니터링
- **PG:** `PaymentGateway` 인터페이스 + `MockGateway` + 실제 PG 어댑터 (정확한 연동 API는 계약 후 확정)

```mermaid
flowchart LR
  Browser[모바일/데스크톱 브라우저] --> Web[Next.js Web]
  Web --> API[NestJS REST API]
  API --> DB[(PostgreSQL)]
  API --> Rules[점수/리포트 룰 엔진]
  API --> Pay[PaymentGateway 어댑터]
  Pay <--> PG[실 PG 또는 로컬 Mock]
  API -. 선택적 .-> LLM[LLM 설명 생성기]
```

### 제안 모노레포 구조

```text
woorisai-lab/
├─ apps/
│  ├─ web/                      # Next.js App Router
│  │  ├─ app/
│  │  ├─ components/
│  │  ├─ lib/api/
│  │  ├─ lib/auth/
│  │  └─ tests/
│  └─ api/                      # NestJS
│     ├─ src/modules/
│     │  ├─ sessions/
│     │  ├─ participants/
│     │  ├─ surveys/
│     │  ├─ results/
│     │  ├─ reports/
│     │  ├─ payments/
│     │  ├─ analytics/
│     │  └─ compliance/
│     ├─ src/common/
│     └─ test/
├─ packages/
│  └─ shared/                   # DTO, enums, survey schema, validators
├─ docs/
│  ├─ woorisai_lab_codex_spec.md
│  ├─ api.md
│  ├─ privacy-data-map.md
│  └─ adr/
├─ infra/
│  ├─ docker-compose.yml
│  └─ ...
├─ .env.example
├─ package.json
└─ README.md
```

### 인증/링크 설계

- `sessionId`는 UUID/ULID 등 랜덤 식별자. **sessionId만으로 개인 결과 접근 불가**.
- 초대 토큰은 CSPRNG 생성 최소 128bit 이상 엔트로피; DB에는 원문이 아닌 SHA-256 등 단방향 해시만 저장.
- A/B 액세스 토큰은 각각 CSPRNG 생성, DB 해시 저장, `HttpOnly + Secure + SameSite=Lax` 쿠키를 기본 사용. 로컬은 Secure 예외를 환경설정으로 한정.
- 쿠키 권한의 상태 변경 엔드포인트에 CSRF 방어(Origin 검증 + CSRF 토큰 또는 적절한 SameSite 정책 조합) 적용.
- 교차 도메인 배포 시 쿠키 전달/CSRF/credentials 설정을 명시적으로 처리; 가능하면 동일 사이트 역프록시로 단순화.
- 초대 링크 유출 시 타인이 B 슬롯을 선점할 수 있으므로 초대 재발급/폐기 및 B 참가 전 확인 UI를 둔다. 보안 강화를 위한 추가 확인은 P1.
- `Referrer-Policy: no-referrer` 및 보안 헤더 적용으로 URL 내 초대 토큰이 제3자 분석/외부 리소스에 전달되지 않게 한다.
- 액세스 토큰을 URL 쿼리로 발급/노출하지 않는다.

---

## 8. 데이터 모델 (PostgreSQL)

### 핵심 테이블

#### `couple_sessions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 세션 ID |
| `status` | enum | `WAITING_FOR_FIRST`, `WAITING_FOR_PARTNER`, `PAIR_COMPLETED`, `EXPIRED`, `DELETED` |
| `survey_version` | varchar | 질문 세트 버전 |
| `algorithm_version` | varchar | 점수 로직 버전 |
| `invite_token_hash` | varchar nullable | 상대용 초대 토큰 해시 |
| `invite_expires_at` | timestamptz | 초대 만료시각 |
| `expires_at` | timestamptz | 미완료 세션 만료시각 |
| `completed_at` | timestamptz nullable | 2인 완료 시각 |
| `created_at`, `updated_at` | timestamptz | 생성/수정 |
| `deleted_at` | timestamptz nullable | 논리삭제/삭제 처리 추적 |

#### `participants`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 참여자 ID |
| `session_id` | uuid FK | 커플 세션 |
| `slot` | enum `A`,`B` | 참가 순서, `(session_id, slot)` UNIQUE |
| `nickname` | varchar(30) | HTML 이스케이프, 실명 불필요 |
| `access_token_hash` | varchar | 개인 액세스 토큰 해시 |
| `joined_at`, `submitted_at` | timestamptz | 접속/제출 시각 |
| `created_at`, `updated_at` | timestamptz | 메타정보 |

#### `survey_questions`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | varchar | Q01~Q12 |
| `survey_version` | varchar | 설문 버전, `(survey_version,id)` PK 구성 가능 |
| `dimension` | enum | 4축 |
| `display_order` | integer | 표시 순서 |
| `text_ko` | text | 질문 |
| `is_active` | boolean | 버전별 노출 여부 |

#### `survey_answers`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 응답 ID |
| `participant_id` | uuid FK | 참여자 |
| `survey_version` | varchar | 버전 |
| `question_id` | varchar | 문항 참조 |
| `value` | smallint CHECK 1..5 | 응답 |
| `updated_at` | timestamptz | 수정 시각 |

**제약:** `UNIQUE(participant_id, survey_version, question_id)`. 참여자 제출 확정 이후에는 수정 불가.

#### `result_snapshots`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 결과 ID |
| `session_id` | uuid FK UNIQUE | 커플 결과 |
| `survey_version` | varchar | 결과 산출 입력 버전 |
| `algorithm_version` | varchar | 산출 알고리즘 버전 |
| `individual_scores_json` | jsonb | A/B 4축 합계/평균 |
| `pair_scores_json` | jsonb | 4축 차이/유사도 |
| `free_report_json` | jsonb | 무료 설명/공통점/차이 |
| `premium_report_json` | jsonb | 유료 리포트 (비공개) |
| `generated_at` | timestamptz | 생성 시점 |

#### `orders`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 내부 주문 ID |
| `session_id` | uuid FK | 구매 대상 세션 |
| `buyer_participant_id` | uuid FK | 결제 시작자 |
| `product_code` | varchar | `PAIR_DEEP_REPORT_V1` |
| `amount_krw` | integer | 3900, 서버 권위 가격 |
| `status` | enum | `PENDING`, `PAID`, `FAILED`, `CANCELED`, `REFUNDED`, `PARTIAL_REFUNDED` |
| `provider` | varchar | PG 이름 |
| `provider_payment_id` | varchar nullable | PG 거래 ID |
| `idempotency_key` | varchar UNIQUE | 중복 주문/승인 방지 |
| `paid_at`, `refunded_at` | timestamptz nullable | 상태 시각 |
| `created_at`, `updated_at` | timestamptz | 메타정보 |

#### `entitlements`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 접근 권한 ID |
| `session_id` | uuid FK | 2인 모두 공유 |
| `product_code` | varchar | 유료 리포트 제품 |
| `source_order_id` | uuid FK | 확정 결제 주문 |
| `status` | enum | `ACTIVE`, `REVOKED` |
| `granted_at`, `revoked_at` | timestamptz nullable | 접근 권한 관리 |

**제약:** `(session_id, product_code)` ACTIVE 권한은 유일. 실제 구현은 부분 unique index 등으로 구현.

#### `payment_events`

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `id` | uuid PK | 내부 이벤트 ID |
| `provider` | varchar | 공급사 |
| `provider_event_id` | varchar | 재전송 중복 방지, `(provider,provider_event_id)` UNIQUE |
| `order_id` | uuid nullable | 연결 주문 |
| `event_type` | varchar | 승인/취소/환불 |
| `processed_at` | timestamptz | 처리 시점 |
| `payload_redacted_json` | jsonb | 민감값 제거한 최소 기록 |

#### `analytics_events`

- `id`, `event_name`, `anonymous_visitor_id`(단기 비식별 식별자), `session_id`(선택), `occurred_at`, `properties_json`(허용키만 저장)
- 개인별 원문 질문 응답, 닉네임, 초대 토큰, 결제 민감정보를 분석 이벤트에 저장하지 않는다.
- 이벤트 보존기간과 쿠키/분석 동의 요건은 정책 확정 후 적용한다.

### 스키마 보안/운영 규칙

- 삭제 요청 시 관련 답변·리포트·개인 토큰을 삭제 또는 비식별 처리한다. 법정 보존 의무가 있는 거래 기록은 별도 분리·접근 제한한다.
- `result_snapshots`의 유료 내용은 공개 API/OG 이미지/클라이언트 번들에 노출 금지.
- TTL 정책 초안: 미완료 세션 14일, 완료 세션 90일(서비스 안내 후 확정), 결제 거래 기록은 법률 검토 후 별도 보존. 정책은 환경설정과 운영 문서로 일치시킨다.
- 데이터 백업, 마이그레이션 롤백 방안, 삭제 작업 감사 추적을 운영 준비 체크리스트에 포함.

---

## 9. REST API 계약 (초안)

기본 경로 `/api/v1`. 모든 API 오류는 `{ code, message, requestId }` 형태로 통일한다. **서버가 현재 쿠키 토큰을 통해 참여자 신원을 확인한다.**

| Method | Path | 목적 | 응답 핵심 |
|---|---|---|---|
| `POST` | `/sessions` | 세션 생성/A 슬롯 발급 | `sessionId`, `status`, 쿠키 |
| `GET` | `/sessions/:id` | 자신의 세션 상태 조회 | `status`, `mySlot`, `partnerJoined`, `pairCompleted` |
| `POST` | `/sessions/:id/join` | 초대 토큰 검증, B 슬롯 점유 | `sessionId`, `mySlot`, 쿠키 |
| `POST` | `/sessions/:id/invite/rotate` | A가 기존 초대 폐기·재발급 | 새 초대 링크 (B 참가 전만) |
| `GET` | `/surveys/current` | 활성 질문(버전 포함) | `version`, `questions` |
| `PUT` | `/sessions/:id/answers` | 내 응답 임시저장 | `savedCount`, `updatedAt` |
| `POST` | `/sessions/:id/submit` | 내 12개 응답 확정 | `status`, `pairCompleted` |
| `GET` | `/sessions/:id/my-result` | 내 개인 무료 결과 | `dimensions`, `description` |
| `GET` | `/sessions/:id/pair-result` | 2인 완료 무료 결과 | `dimensionComparisons`, `commonPoints`, `differences`, `sampleQuestions` |
| `POST` | `/sessions/:id/orders` | 유료 제품 주문 생성 | `orderId`, `amount`, `checkoutPayload` |
| `GET` | `/orders/:id` | 본인 세션 주문 상태 | `status`, `paidAt` |
| `POST` | `/payments/confirm` | 결제 승인 검증 시작 (PG 방식별) | 서버 확인 결과 |
| `POST` | `/payments/webhook/:provider` | PG 웹훅 수신/서명 검증 | 수신/처리 상태 |
| `GET` | `/sessions/:id/premium-report` | 유료 결과 열람 | `reportSections`, `generatedAt` |
| `POST` | `/sessions/:id/delete` | 개인/세션 삭제 요청 | 접수 상태 및 범위 안내 |
| `POST` | `/analytics/events` | 제한된 이벤트 수집 | `accepted` |

### API 예시

**`PUT /api/v1/sessions/{id}/answers`**

```json
{
  "surveyVersion": "1.0.0",
  "answers": [
    { "questionId": "Q01", "value": 4 },
    { "questionId": "Q02", "value": 2 }
  ]
}
```

**`GET /api/v1/sessions/{id}/pair-result`**

```json
{
  "sessionId": "example-uuid",
  "surveyVersion": "1.0.0",
  "algorithmVersion": "1.0.0",
  "dimensions": [
    {
      "key": "EMOTION",
      "aScore": 3.67,
      "bScore": 4.0,
      "difference": 0.33,
      "alignment": 92,
      "summary": "감정을 표현하는 방식이 비슷한 편이에요."
    }
  ],
  "freePrompts": ["서운한 일이 있을 때 언제 이야기하는 게 편할까요?"],
  "hasPremiumAccess": false
}
```

이 예시는 형식 설명용이며 실제 응답에는 4축 결과가 모두 포함되어야 한다.

### 오류 코드 예시

- `INVITE_INVALID`, `INVITE_EXPIRED`, `PARTNER_SLOT_TAKEN`
- `SESSION_EXPIRED`, `SESSION_NOT_FOUND`, `UNAUTHORIZED_PARTICIPANT`
- `SURVEY_VERSION_MISMATCH`, `ANSWERS_INCOMPLETE`, `ANSWERS_LOCKED`
- `PAIR_NOT_COMPLETED`, `PREMIUM_REQUIRED`
- `ORDER_ALREADY_PAID`, `PAYMENT_PENDING`, `PAYMENT_VERIFICATION_FAILED`
- `RATE_LIMITED`, `INTERNAL_ERROR`

### 보안 및 속도 제한

- 공개 세션 생성, 초대 수락, 결제 승인, 분석 이벤트에 IP 기반 및 세션 기반 속도 제한.
- 서버가 결제 금액/상품코드를 직접 조회하고 클라이언트 입력 가격은 무시.
- 모든 세션 접근은 `sessionId + 참여자 토큰` 검증 필요.
- 초대 토큰 단독으로 기존 A/B 답변을 읽을 수 없게 구현.
- `/payments/webhook`는 PG 공식 서명 검증, 리플레이 보호, 멱등 처리 필수.
- 응답 오류와 서버 로그에는 답변 원문·토큰·PG 인증정보를 남기지 않음.

---

## 10. 결제 상세 설계

### 추상화

```ts
interface PaymentGateway {
  createCheckout(input: {
    orderId: string;
    amountKRW: number;
    productName: string;
    returnUrl: string;
  }): Promise<{ checkoutPayload: unknown }>;

  verifyOrConfirm(input: {
    orderId: string;
    providerPaymentId?: string;
    verificationData?: unknown;
  }): Promise<{
    providerPaymentId: string;
    amountKRW: number;
    status: 'PAID' | 'PENDING' | 'FAILED' | 'CANCELED';
  }>;

  verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<{
    eventId: string;
    providerPaymentId: string;
    eventType: string;
  }>;
}
```

### 서버 결제 프로세스

1. 두 응답이 완료되었고, 구매 권한이 없음을 서버에서 검증.
2. 서버의 상품 테이블/상수로 금액 3,900원 확정. `PENDING` 주문 생성.
3. 사용자가 PG 결제창에서 결제.
4. 브라우저 리턴과 PG 웹훅을 각각 받더라도 결제 결과는 **PG 서버 검증** 후 확정.
5. 주문번호, PG 거래번호, 금액, 통화, 결제 상태가 정확히 일치하는지 확인.
6. DB 트랜잭션 내 주문 `PAID` + entitlement `ACTIVE`를 멱등하게 처리.
7. 사용자는 결제 보류 시 `확인 중` 상태를 보고 재조회 가능. 중복 결제 유도 금지.
8. 환불·취소 발생 시 상태와 권한을 정책에 맞게 동기화.

**MockGateway:** 로컬에서만 테스트 결제 성공/실패/보류를 시뮬레이션. `NODE_ENV=production`에서 mock 결제 활성화 시 앱 부팅 실패하도록 안전장치 설정.

**주의:** PG 업체별 승인, 웹훅, 부분취소 정책은 다르므로 실제 공급사 확정 후 해당 인터페이스를 세부 조정한다. 검증되지 않은 엔드포인트 이름/서명을 구현하지 않는다.

---

## 11. 분석 이벤트 및 지표

### 수집 이벤트

| 이벤트 | 발생 시점 |
|---|---|
| `landing_viewed` | 랜딩 유효 조회 |
| `test_started` | 세션 생성 성공 |
| `survey_answered` | 문항 응답(문항값 미포함) |
| `survey_submitted_a` | A 제출 성공 |
| `invite_copied` | 초대 링크 복사 |
| `partner_joined` | B 참가 성공 |
| `survey_submitted_b` | B 제출 성공 |
| `pair_completed` | 두 사람 모두 완료 |
| `free_result_viewed` | 무료 비교 최초 열람 |
| `premium_cta_clicked` | 결제 CTA 클릭 |
| `checkout_started` | 주문/결제 시작 |
| `payment_succeeded` | 서버 승인 성공 |
| `payment_failed` | 실패/취소 |
| `premium_report_viewed` | 유료 열람 |
| `share_used` | 공유 기능 사용 |

### 계산 지표

- `start_rate = 시작 세션 수 / 유효 랜딩 방문자 수`
- `A_completion_rate = A 제출 세션 수 / 시작 세션 수`
- `invite_rate = 링크 공유 세션 수 / A 제출 세션 수`
- `pair_completion_rate = 2인 완료 세션 수 / 시작 세션 수`
- `checkout_rate = 결제 시작 세션 수 / 무료 결과 열람 세션 수`
- `paid_conversion_rate = 유료 결제 완료 세션 수 / 무료 결과 열람 세션 수`
- `gross_revenue = 확정 결제액 합계`, `net_revenue = 결제액 - 환불 - PG 수수료 - 운영 원가` (세금 별도)

**주의:** 사용자 2명이 한 세션을 만들기 때문에 방문자/세션 분모를 혼용하지 않는다. 퍼널 대시보드에 지표 분모를 반드시 명시한다.

---

## 12. 개인정보·운영·법적 체크리스트

> 아래는 기술 요구사항이며 법률 자문이 아니다. 실제 출시 전 국내 개인정보·전자상거래·결제 관련 최신 법적 요건을 검토할 것.

- [ ] 사업자등록/전자상거래 관련 신고 및 표시 의무 확인.
- [ ] 이용약관, 개인정보 처리방침, 유료 콘텐츠 이용·취소·환불 고지 작성.
- [ ] 개인정보 최소수집: 실명·생년월일·휴대전화번호 없이도 사용 가능하게 설계.
- [ ] 초대 링크에 포함된 토큰이 제3자에게 유출되지 않도록 외부 분석·리퍼러 차단.
- [ ] 제3자 LLM 사용 시 개인정보 전송 여부·위탁/국외이전 여부 검토 및 사용자 안내.
- [ ] 결과/원문 답변 보유 기간, 삭제 방법 및 2인 세션 삭제 정책을 명확하게 안내.
- [ ] 데이터 삭제 시 상대방의 권리와 구매기록 보존 의무가 충돌하는 사례 검토.
- [ ] 미성년자 서비스 이용/결제 정책 확정. 첫 MVP는 **성인 대상**으로 운영.
- [ ] 실제 결제 전 표시: 상품명, 가격, 제공 내용, 디지털 콘텐츠 특성, 환불 조건.
- [ ] 고객지원 이메일/문의 채널 및 결제 장애 대응 절차 준비.
- [ ] CSP, HSTS, XSS 방어, SQL 파라미터 바인딩, 보안 헤더, 비밀 키 회전 절차.
- [ ] 데이터베이스 접근 최소 권한, 운영 환경 백업, 관측/알림 및 장애 복구 계획.
- [ ] 보안 사고·개인정보 침해 대응 절차 문서화.

### 이용자에게 보여줄 한계 고지 예시

> 우리사이 연구소의 결과는 두 사람의 설문 응답에 기반한 참고 콘텐츠입니다. 전문 심리검사, 상담, 의료·정신건강 진단 또는 미래 예측이 아니며, 상대방의 실제 감정이나 관계의 성공 여부를 판단하지 않습니다.

---

## 13. 테스트 계획 및 인수 조건

### 단위 테스트

- 12문항 누락/1~5 범위 밖 입력 거부.
- 동일 입력과 동일 버전에서 항상 동일 점수·문구·차이 TOP5 생성.
- A/B를 뒤바꿔도 커플 차이·유사도 점수는 동일함.
- 점수 범위는 0~100이며, 모든 항목 같은 답변이면 100.
- Q01~Q12 각각 1 또는 5 응답 시 산술 결과 경계 검증.
- 결과 생성은 두 참가자 제출 완료 시 딱 한 번 스냅샷 저장.

### 통합 테스트

- B 슬롯 두 브라우저 동시 참가 시 1명만 성공.
- A 토큰으로 B의 임시 답변 접근 불가.
- 초대 토큰 만료/폐기 후 참가 불가.
- 제출 완료 후 답변 수정 불가.
- 유료 결과 API는 결제 전 403, 결제 후 A/B 200.
- 중복 결제 콜백/웹훅에서도 주문·권한 1회 반영.
- 금액 위조·거래번호 위조·미검증 PG 결과는 승인 불가.
- 데이터 삭제 뒤 토큰 무효화.

### E2E (Playwright)

1. 모바일 390px 뷰에서 A가 생성 → 응답 12개 완료 → 초대 링크 복사.
2. 독립 브라우저 컨텍스트에서 B가 링크 참가 → 응답 완료.
3. 두 브라우저 모두 결과 페이지에서 같은 비교 수치를 확인.
4. A가 MockGateway 성공 결제 → 양쪽 유료 리포트 접근 가능.
5. 실패/취소 결제 후 무료 결과는 유지되고 유료 결과 접근은 차단.
6. 만료 링크, 새로고침, 네트워크 오류, 뒤로가기, 중복 제출 테스트.
7. 키보드 탐색 및 기본 접근성 검사.

### 출시 차단 조건

- 심층 리포트가 권한 검증 없이 노출되는 경우
- 결제 성공 확인 전 권한이 부여되는 경우
- 상대의 미완료 원문 응답이 노출되는 경우
- 답변 데이터 유실 또는 결과 점수 불일치
- 미정의 환불/문의 정책 상태에서 실결제 공개

---

## 14. 단계별 개발 계획 (Codex용)

### Phase 1 — 프로젝트 골격 + 설문 도메인

**목표:** 로컬에서 A가 12문항을 진행하고 저장할 수 있음.

- [ ] 모노레포 구성, 린트/타입체크/포맷, Docker Compose DB
- [ ] NestJS 모듈, TypeORM migration 및 seed
- [ ] 12문항 API 및 입력 검증
- [ ] Next.js 랜딩/시작/설문 기본 UI
- [ ] 세션 생성·개인 토큰·임시 저장·제출
- [ ] README와 `.env.example`, 기본 API 테스트

**완료 정의:** `docker compose up`, `pnpm dev`, 단위 테스트로 단독 A 흐름 실행 가능.

### Phase 2 — 2인 초대 + 무료 결과

**목표:** A/B 각각 제출 → 무료 결과 생성.

- [ ] 링크 발급·회전·만료, B 슬롯 점유 트랜잭션
- [ ] 대기 UI 및 초대 공유
- [ ] 4축 점수/차이 분석 룰 엔진
- [ ] 결과 스냅샷, 무료 비교 차트, 공유 카드
- [ ] 권한·동시성 테스트, E2E 2인 시나리오

**완료 정의:** 서로 다른 두 브라우저에서 완전한 무료 체험 가능.

### Phase 3 — 유료 심층 리포트 + Mock 결제

**목표:** 실제 PG 없이 전체 유료 사용자 경험 검증.

- [ ] 심층 설명/문항 TOP5/대화 질문 10개 생성
- [ ] 상품/주문/권한/PG 어댑터 설계
- [ ] Mock 성공·실패·보류, 환불 상태 테스트
- [ ] 결제 UI, 구매 완료, A/B 공통 열람, 인쇄형 PDF
- [ ] 멱등성·위조·권한 회귀 테스트

**완료 정의:** 로컬 결제 시나리오 전 경로 자동 테스트 통과.

### Phase 4 — 실결제/운영 준비

**목표:** 합법적·안전하게 유료 출시할 수 있는 상태.

- [ ] PG 공급사 선정, 계약/심사, 실제 결제 API 및 웹훅 연동
- [ ] 정책 문서 검토, 고객지원·환불 처리 경로
- [ ] 운영 환경 HTTPS/모니터링/백업/요청 제한
- [ ] 지표 수집과 퍼널 쿼리
- [ ] 소액 실결제/취소 테스트 및 공개 전 점검

**완료 정의:** 실거래 성공/실패/환불 경로 검증, 필수 정책 게시, 운영 알림 설정 완료.

### Phase 5 — 제한 공개 / 실험

- [ ] 30~50명에게 테스트 요청, 막히는 단계 관찰
- [ ] 실제 300명 유효 방문 기준으로 퍼널 측정
- [ ] 3,900원 결제 시도와 완료·환불·CS 이슈 기록
- [ ] 필요 시 랜딩 문구/무료 가치/CTA 한 가지씩 개선
- [ ] 후속 실험 여부 판단: **2인 완료율 개선 → 유료 가치 강화 → 신규 상품** 순서

---

## 15. 개발 우선순위와 구현 보류 결정

| 항목 | 결정 | 이유 |
|---|---|---|
| 로그인 | 초기 제외 | 방문·초대 진입 장벽 감소 |
| 설문 문항 | 12개 고정 | 결과 품질과 완료율 균형 실험 |
| 결과 산출 | 규칙 기반 | 재현성·비용 통제·환각 방지 |
| AI 문장 생성 | 선택적 | 전환 지표 확인 후 사용 |
| 과금 | 1회 3,900원 | 심플한 소액 결제 실험 |
| 구독 | 제외 | 초기 결제 이유가 불명확 |
| 인쇄 PDF | 브라우저 print CSS 우선 | 서버 렌더링 복잡성 최소화 |
| 웹 푸시/메일 | 제외 | 개인정보/운영 부담 최소화 |
| 고객 문의 | 초기 단순 문의 채널 | 실유저 지원 우선 |
| UI 디자인 | 모바일 우선 반응형 | 공유 링크 유입 대응 |

---

## 16. 환경 변수 예시

```dotenv
# 앱
NODE_ENV=development
WEB_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
PORT=4000

# 데이터
DATABASE_URL=postgresql://woorisai:localonly@localhost:5432/woorisai

# 쿠키/토큰
COOKIE_SECURE=false
SESSION_TOKEN_HASH_PEPPER=CHANGE_ME_RANDOM_SECRET

# 결제
PAYMENT_PROVIDER=mock
PAYMENT_PRODUCT_PRICE_KRW=3900
# 실제 PG 선정 후 해당 공식 변수명을 별도 정의

# AI (선택)
REPORT_GENERATOR=template
# LLM_API_KEY=

# 로깅
LOG_LEVEL=info
```

**주의:** `.env.example`에 실제 비밀값을 넣지 않는다. 운영에서 `COOKIE_SECURE=true`, HTTPS, 실제 PG를 강제한다. 위 DATABASE_URL은 **로컬 개발 예시만** 해당한다.

---

## 17. 보완이 필요한 사업·제품 결정 (출시 전 결정)

1. **서비스명:** `우리사이 연구소`는 가칭. 실제 상표/도메인 사용 가능 여부 확인.
2. **성인 확인:** 성인 대상으로 안내하되, 연령 검증을 어떤 수준으로 할지 확정.
3. **결제 사업자:** 지원하는 PG/중개 솔루션과 수수료, 심사조건, 결제 플로우 확인.
4. **환불 정책:** 디지털 콘텐츠 제공 전·후 청약철회 등 법률 검토 후 정확한 고지 작성.
5. **결과 유효성:** 문항 편향·불쾌감·오해 소지를 소규모 사용자 테스트로 수정.
6. **개인정보:** 분석 쿠키, 제3자 처리, 삭제/보존과 법정 기록 보관 구분 확정.
7. **결과 접근성:** 기기 변경/브라우저 데이터 삭제 사용자용 복구 절차는 P1에서 설계.
8. **카피라이팅:** ‘궁합’이라는 표현이 판정/예언처럼 보이지 않게 실제 화면 검토.

---

## 18. Definition of Done (최종 인수 체크리스트)

- [ ] 처음 방문한 두 사람이 **회원가입 없이** 서로 다른 브라우저에서 테스트를 마칠 수 있다.
- [ ] 각자가 응답한 12문항으로 **일관된 4축 결과와 비교 결과**가 나온다.
- [ ] 2인 결과 완료 전에는 상대의 원문 답변/커플 결과가 공개되지 않는다.
- [ ] 무료 결과가 별도 결제 없이 충분히 유용하다.
- [ ] 심층 리포트는 3,900원 1회 결제로 구매 가능하며 구매자는 물론 상대도 열람할 수 있다.
- [ ] 서버 검증되지 않은 결제 성공은 절대 권한을 만들지 못한다.
- [ ] 동일 주문/웹훅 중복 호출에도 과금·권한 중복이 발생하지 않는다.
- [ ] 참가자 토큰·초대 링크를 통한 비인가 접근이 차단된다.
- [ ] 개인정보 처리방침, 약관, 환불 및 고객지원 안내가 게시된다.
- [ ] 모바일 화면 및 Playwright 주요 E2E 테스트가 통과한다.
- [ ] 각 단계 퍼널 이벤트와 실제 매출/환불을 분리해서 측정할 수 있다.
- [ ] 사용자가 `README.md`만 보고 로컬 실행·테스트·배포 준비를 재현할 수 있다.

---

## 19. Codex 후속 작업 프롬프트

### 1단계: 스캐폴딩

```text
설계서 Phase 1만 구현해줘. pnpm workspace 모노레포, Next.js 앱, NestJS API, PostgreSQL Docker Compose, TypeORM migrations, survey 12문항 seed, 세션 생성 및 개인 토큰, 설문 진행/임시저장/제출을 구현하고 README·.env.example·테스트를 제공해. 결제는 구현하지 마.
```

### 2단계: 2인 무료 MVP

```text
Phase 1 구현을 검토한 뒤 Phase 2를 구현해줘. 초대 토큰과 B 슬롯 원자적 수락, A/B 접근 권한, 4축 결정적 점수 엔진, 무료 결과 스냅샷, 모바일 결과 화면 및 Playwright 2인 E2E 테스트를 작성해. 상대방의 임시 응답은 절대 유출되지 않게 해.
```

### 3단계: 유료 흐름

```text
Phase 3를 구현해줘. 3,900원 심층 리포트, 템플릿 기반 설명, 주문/entitlement/결제 이벤트 테이블, MockGateway, 성공·실패·중복 웹훅 시나리오, 두 참여자의 유료 결과 접근과 인쇄 PDF를 구현해. 실제 PG가 없다는 점을 UI와 문서에서 명확히 구분해.
```

### 4단계: 출시 점검

```text
Phase 4 출시 준비를 점검해줘. 실제 결제 PG 연동 전에 필수로 결정해야 하는 항목, 개인정보 및 환불 정책 문서의 미확정 부분, 보안 테스트·모니터링·백업 체크리스트를 작성하고 실결제 출시 차단 조건을 테스트해. 실제 PG 스펙을 추측해서 구현하지 마.
```

---

**문서 끝.**
