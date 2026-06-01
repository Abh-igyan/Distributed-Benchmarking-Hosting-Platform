const STATUS_STYLE = {
  completed: "success",
  failed: "danger",
  failed_handoff: "danger",
  stopped: "muted",
  benchmarking: "active",
  building: "active",
  checking_correctness: "active",
  starting_correctness: "active",
  starting_benchmark: "active",
  restarting_for_benchmark: "active",
};

function readableStatus(status) {
  return (status || "waiting").replaceAll("_", " ");
}

function StatusBadge({ status }) {
  const tone = STATUS_STYLE[status] || "neutral";

  return <span className={`status-badge status-badge--${tone}`}>{readableStatus(status)}</span>;
}

export default StatusBadge;
