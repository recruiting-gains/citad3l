-- Citad3L visitor source report (read-only). Per America/Chicago day and source:
-- landings, unique first-touch visitors, guest starts, signups, first payments and their revenue.
--
-- Usage (any DB URL; the transaction is READ ONLY so it can't change anything):
--   psql "$DATABASE_URL" -v days=7 -f scripts/source-report.sql
-- days defaults to 7 (today plus the 6 days before it).
\if :{?days}
\else
  \set days 7
\endif

BEGIN TRANSACTION READ ONLY;

WITH bounds AS (
  SELECT to_char((now() AT TIME ZONE 'America/Chicago')::date - (:days::int - 1), 'YYYY-MM-DD') AS first_day
),
landings AS (
  SELECT day, source, count(*) AS landings, count(DISTINCT "visitorHash") AS visitors,
         count(*) FILTER (WHERE tagged) AS tagged_landings
  FROM "VisitSource", bounds WHERE day >= bounds.first_day
  GROUP BY day, source
),
conv AS (
  SELECT day, source,
         count(*) FILTER (WHERE kind = 'guest_start') AS guest_starts,
         count(*) FILTER (WHERE kind = 'signup') AS signups,
         count(*) FILTER (WHERE kind = 'payment') AS payments,
         coalesce(sum("amountCents") FILTER (WHERE kind = 'payment'), 0) AS paid_cents
  FROM "SourceAttribution", bounds WHERE day >= bounds.first_day
  GROUP BY day, source
)
SELECT coalesce(l.day, c.day) AS day,
       coalesce(l.source, c.source) AS source,
       coalesce(l.landings, 0) AS landings,
       coalesce(l.visitors, 0) AS tracked_visitors,
       coalesce(c.guest_starts, 0) AS guest_starts,
       coalesce(c.signups, 0) AS signups,
       coalesce(c.payments, 0) AS payments,
       round(coalesce(c.paid_cents, 0) / 100.0, 2) AS paid_usd
FROM landings l
FULL OUTER JOIN conv c ON c.day = l.day AND c.source = l.source
ORDER BY 1 DESC, 3 DESC, 2;

-- Totals by source for the whole window, with campaign/content detail for tagged links.
WITH bounds AS (
  SELECT to_char((now() AT TIME ZONE 'America/Chicago')::date - (:days::int - 1), 'YYYY-MM-DD') AS first_day
)
SELECT source, coalesce(campaign, '-') AS campaign, coalesce(content, '-') AS content, count(*) AS landings
FROM "VisitSource", bounds
WHERE day >= bounds.first_day AND tagged
GROUP BY 1, 2, 3
ORDER BY 4 DESC, 1;

ROLLBACK;
