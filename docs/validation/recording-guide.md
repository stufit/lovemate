# 익명 관찰 기록과 집계

실제 관찰은 아직 없습니다. 예제 파일의 null은 ‘미관찰’이며 실패나 성공이 아닙니다.

```sh
pnpm validation:init
# 생성된 .local-validation/records.json을 실제 관찰 후 수정
pnpm validation:report
```

초기화는 기존 기록을 덮어쓰지 않습니다. `.local-validation/` 전체는 Git에서 제외됩니다. 사람의 이름·연락처·응답·초대 링크·세션 ID·대화 내용을 추가하지 않습니다. 집계기는 허용한 필드만 받으며 자유서술을 지원하지 않습니다.

| 필드 | 값 | 기록 기준 |
|---|---|---|
| pairId | P01~P10 | 모집 전에 정한 익명 코드, 첫 판단은 P01~P05 고정 |
| status | NOT_STARTED / STARTED / COMPLETED / STOPPED | 실제 진행 상태. 중단을 완료로 바꾸지 않기 |
| understoodWithoutHelp | true / false / null | 진행자 설명 없이 결과 의미를 올바르게 설명했는가 |
| startedConversation | true / false / null | 실제 대화를 시작했다고 확인했는가 |
| describedSpecificValue | true / false / null | 어떤 요소가 어떤 행동에 도움이 됐는지 설명했는가 |
| similarAnswerCase | true / false / null | 답변이 가깝게 나온 상황의 가이드도 직접 관찰했는가 |
| premiumIntention | NOT_ASKED / YES / NO / UNSURE | 무료 결과 후 가이드 체험 전, 최초 가격 반응 |
| accessMethod | NONE / SAMPLE / MOCK | 유료 가이드 체험 방법. 실제 구매 항목 없음 |
| issues | 허용 코드 배열 | LANDING, QUESTION_WORDING, SAVE_RESTORE, INVITE, RESULT, GUIDE, DELETE, ANSWER_EXPOSURE, WRONG_EXPLANATION, OTHER |

`describedSpecificValue=true`는 `startedConversation=true`일 때만 가능합니다. 완료 기록에는 위 네 관찰 항목의 true/false가 필요합니다. STARTED·STOPPED에서 아직 확인하지 못한 값은 null로 남깁니다. 중단한 사례를 임의로 실패/성공으로 채우지 않습니다.

집계는 첫 5쌍의 ‘아직 관찰 안 함’, ‘진행 중’, ‘완료’, ‘중단’을 나눕니다. 이해와 대화·가치의 수치는 5쌍 기준의 확인된 건수이며, 확인되지 않은 항목을 분자에 넣지 않습니다. 완료 기록의 누락은 판정을 유보합니다. 실제 인터뷰 없이 예제를 성공 값으로 바꾸지 않습니다.

다섯 쌍 관찰이 끝나면, 기준 미달 또는 제품 문제에 맞춰 개선합니다. 기준이 맞더라도 결과는 **소규모 콘텐츠 실험 기준 충족**일 뿐입니다. 실제 결제 의향과 유료 사용성은 별도 검증이 필요합니다.
