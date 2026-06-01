const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const WS_URL =
  import.meta.env.VITE_WS_URL || API_BASE.replace(/^http/, "ws") + "/ws/leaderboard";

export { API_BASE, WS_URL };
