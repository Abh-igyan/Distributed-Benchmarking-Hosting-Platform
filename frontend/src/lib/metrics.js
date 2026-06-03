function formatNumber(value, digits = 2) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return numberValue.toFixed(digits);
}

function formatPercent(value, digits = 1) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "-";
  return `${numberValue.toFixed(digits)}%`;
}

function successRate(row) {
  if (!row?.total_requests) return 0;
  return (Number(row.success || 0) / Number(row.total_requests)) * 100;
}

function shortId(id) {
  if (!id) return "-";
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function getResult(status, leaderboard = [], submissionId = null) {
  const leaderboardResult = submissionId
    ? leaderboard.find((row) => String(row.submission_id) === String(submissionId))
    : null;

  if (leaderboardResult?.correctness_checks) return leaderboardResult;
  if (status?.result) return status.result;
  if (status?.docker?.result) return status.docker.result;
  return leaderboardResult || null;
}

export { formatNumber, formatPercent, getResult, shortId, successRate };
