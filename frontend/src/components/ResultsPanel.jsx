import StatusBadge from "./StatusBadge";
import { formatNumber, formatPercent, getResult, shortId, successRate } from "../lib/metrics";

const CHECK_LABELS = {
  empty_book: "Empty book",
  duplicate_orders: "Duplicate orders",
  invalid_side: "Invalid side",
  market_order_execution: "Market order execution",
  price_time_priority: "Price time priority",
  multiple_fills: "Multiple fills",
  partial_fills: "Partial fills",
  cancellation: "Cancellation",
  remaining_quantity: "Remaining quantity",
};

function ResultsPanel({
  currentSubmission,
  leaderboard,
  recentSubmissions,
  status,
  onSelectSubmission,
}) {
  const result = getResult(status, leaderboard, currentSubmission?.submission_id);
  let checks = result?.correctness_checks || {};

  if (typeof checks === "string") {
    try {
      checks = JSON.parse(checks);
    } catch {
      checks = {};
    }
  }

  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Contestant view</p>
          <h3>My results</h3>
        </div>
        <StatusBadge status={status?.status} />
      </div>

      {status?.error && (
        <div className="error-banner">
          <h4>Submission Error</h4>
          <pre>{status.error}</pre>
        </div>
      )}

      <div className="results-layout">
        <div className="result-summary">
          {currentSubmission ? (
            <>
              <dl className="details-list">
                <div>
                  <dt>Submission</dt>
                  <dd title={currentSubmission.submission_id}>{shortId(currentSubmission.submission_id)}</dd>
                </div>
                <div>
                  <dt>Contestant</dt>
                  <dd>{status?.contestant_name || currentSubmission.contestant_name || "Anonymous"}</dd>
                </div>
                <div>
                  <dt>Language</dt>
                  <dd>{status?.language || currentSubmission.language || "Unspecified"}</dd>
                </div>
              </dl>

              <div className="score-grid">
                <article>
                  <span>Score</span>
                  <strong>{formatNumber(result?.score)}</strong>
                </article>
                <article>
                  <span>Correctness</span>
                  <strong>{formatNumber(result?.correctness_score, 0)}</strong>
                </article>
                <article>
                  <span>TPS</span>
                  <strong>{formatNumber(result?.tps)}</strong>
                </article>
                <article>
                  <span>Success</span>
                  <strong>{formatPercent(successRate(result))}</strong>
                </article>
              </div>

              <div className="latency-row">
                <span>P50 {formatNumber(result?.p50_latency_ms)} ms</span>
                <span>P90 {formatNumber(result?.p90_latency_ms)} ms</span>
                <span>P99 {formatNumber(result?.p99_latency_ms)} ms</span>
                <span>Failures {result?.failures ?? "-"}</span>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <h4>No submission selected</h4>
              <p>Submit a package or choose a recent submission to track its result.</p>
            </div>
          )}
        </div>

        <aside className="side-panel">
          <h4>Correctness checks</h4>
          <ul className="check-list">
            {Object.entries(CHECK_LABELS).map(([key, label]) => {
              const hasCheck = key in checks;
              let checkStatus = "Pending";
              let checkClass = "check-wait";
              if (hasCheck) {
                if (checks[key]) {
                  checkStatus = "Pass";
                  checkClass = "check-pass";
                } else {
                  checkStatus = "Fail";
                  checkClass = "check-fail";
                }
              }
              return (
                <li key={key}>
                  <span>{label}</span>
                  <strong className={checkClass}>{checkStatus}</strong>
                </li>
              );
            })}
            {checks.book_fetch_failed && (
              <li key="book_fetch_failed">
                <span>Book fetch</span>
                <strong className="check-fail">Fail</strong>
              </li>
            )}
            {checks.exception_raised && (
              <li key="exception_raised">
                <span>Exception</span>
                <strong className="check-fail">Fail</strong>
              </li>
            )}
          </ul>
        </aside>
      </div>

      <div className="recent-panel">
        <h4>Recent submissions</h4>
        <div className="recent-list">
          {recentSubmissions.length ? (
            recentSubmissions.map((submission) => (
              <button
                className={
                  currentSubmission?.submission_id === submission.submission_id
                    ? "recent-item recent-item--active"
                    : "recent-item"
                }
                key={submission.submission_id}
                onClick={() => onSelectSubmission(submission)}
                type="button"
              >
                <span>{submission.contestant_name}</span>
                <code>{shortId(submission.submission_id)}</code>
              </button>
            ))
          ) : (
            <p className="muted-text">No local submissions yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default ResultsPanel;
