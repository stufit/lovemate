-- Local/mock traffic only. These are operational aggregates, NOT market validation.
-- Public landing counts include only optional analytics consent; do not use them
-- as the denominator for all visitors. Use matured start-date cohorts (7 days).
WITH cohort AS (
  SELECT * FROM couple_sessions WHERE created_at < now() - interval '7 days'
), completed AS (
  SELECT count(*) AS n FROM cohort WHERE completed_at IS NOT NULL
), viewed AS (
  SELECT count(DISTINCT p.session_id) AS n FROM participants p JOIN cohort c ON c.id=p.session_id
  WHERE p.free_result_viewed_at IS NOT NULL
), paid AS (
  SELECT count(DISTINCT o.session_id) AS n FROM orders o JOIN cohort c ON c.id=o.session_id
  WHERE o.paid_at IS NOT NULL
)
SELECT (SELECT count(*) FROM cohort) AS started_sessions,
       completed.n AS completed_pair_sessions, viewed.n AS free_viewed_sessions,
       paid.n AS mock_purchased_sessions,
       completed.n::numeric/NULLIF((SELECT count(*) FROM cohort),0) AS pair_completion_rate,
       paid.n::numeric/NULLIF(viewed.n,0) AS mock_conversion_rate
FROM completed,viewed,paid;

-- scope-specific response, conversation use and helpfulness; count people, not couples.
WITH views AS (
  SELECT 'FREE' AS scope,count(*) AS n FROM participants WHERE free_result_viewed_at IS NOT NULL
  UNION ALL
  SELECT 'PREMIUM',count(*) FROM participants WHERE premium_report_viewed_at IS NOT NULL
), responses AS (
  SELECT scope,count(*) AS n,
    count(*) FILTER(WHERE used_for_conversation='YES') AS used,
    count(*) FILTER(WHERE used_for_conversation='YES' AND helpful='YES') AS helpful
  FROM session_feedback GROUP BY scope
)
SELECT v.scope,v.n AS viewed_participants,COALESCE(r.n,0) AS respondents,
       r.n::numeric/NULLIF(v.n,0) AS response_rate,
       r.used::numeric/NULLIF(r.n,0) AS reported_conversation_use_rate,
       r.helpful::numeric/NULLIF(r.used,0) AS reported_helpful_rate
FROM views v LEFT JOIN responses r USING(scope);

-- Gateway amounts are mock, with paid and refunded separated. Fees/costs unknown.
SELECT provider,count(*) FILTER(WHERE paid_at IS NOT NULL) AS paid_orders,
       count(*) FILTER(WHERE status='REFUNDED') AS refunded_orders,
       COALESCE(sum(amount_krw) FILTER(WHERE paid_at IS NOT NULL),0) AS mock_gross_krw,
       COALESCE(sum(amount_krw) FILTER(WHERE status='REFUNDED'),0) AS mock_refunded_krw
FROM orders GROUP BY provider;
