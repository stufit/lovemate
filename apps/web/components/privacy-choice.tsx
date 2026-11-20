"use client";
import { useEffect, useState } from "react";
export function PrivacyChoice() {
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(
    () => setEnabled(localStorage.getItem("woorisai_analytics") === "yes"),
    [],
  );
  return (
    <div className="panel" style={{ marginTop: 25 }}>
      <h2 style={{ marginTop: 0 }}>선택형 이용 통계</h2>
      <p>
        랜딩·샘플 열람, 초대 링크 복사 등의 익명 이용 통계를 허용할 수 있어요.
        선택하지 않아도 모든 기능을 이용할 수 있고, 답변 내용은 전송하지 않아요.
      </p>
      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            localStorage.setItem(
              "woorisai_analytics",
              e.target.checked ? "yes" : "no",
            );
            setSaved(true);
          }}
        />
        <span>선택형 익명 이용 통계에 동의해요.</span>
      </label>
      {saved && (
        <p className="small" role="status">
          설정을 저장했어요.
        </p>
      )}
    </div>
  );
}
