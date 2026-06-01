import { formatNumber, formatPercent, shortId, successRate } from "../lib/metrics";

function LeaderboardTable({ currentSubmissionId, leaderboard }) {
  return (
    <section className="content-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Rankings</p>
          <h3>Live leaderboard</h3>
        </div>
        <span className="section-tag">{leaderboard.length} results</span>
      </div>

      <div className="table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Contestant</th>
              <th>Submission</th>
              <th>Score</th>
              <th>Correctness</th>
              <th>TPS</th>
              <th>Success</th>
              <th>P99</th>
              <th>Failures</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.length ? (
              leaderboard.map((row, index) => (
                <tr
                  className={currentSubmissionId === row.submission_id ? "is-current" : ""}
                  key={row.submission_id || index}
                >
                  <td>{index + 1}</td>
                  <td>{row.contestant_name || "Anonymous"}</td>
                  <td title={row.submission_id}>{shortId(row.submission_id)}</td>
                  <td>{formatNumber(row.score)}</td>
                  <td>{formatNumber(row.correctness_score, 0)}</td>
                  <td>{formatNumber(row.tps)}</td>
                  <td>{formatPercent(successRate(row))}</td>
                  <td>{formatNumber(row.p99_latency_ms)} ms</td>
                  <td>{row.failures ?? "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-table" colSpan="9">
                  Waiting for completed benchmark runs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default LeaderboardTable;
