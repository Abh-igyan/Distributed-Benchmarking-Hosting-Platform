function AppShell({ activeView, children, connectionState, onViewChange, submissionCount }) {
  const navItems = [
    { id: "submit", label: "Submit" },
    { id: "results", label: "My Results" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">IC</div>
          <div>
            <p className="eyebrow">IICPC</p>
            <h1>Benchmark Console</h1>
          </div>
        </div>

        <nav className="nav-list" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              className={activeView === item.id ? "nav-item nav-item--active" : "nav-item"}
              key={item.id}
              onClick={() => onViewChange(item.id)}
              type="button"
            >
              <span className="nav-dot" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Live competition environment</p>
            <h2>Submissions and benchmark results</h2>
          </div>
          <div className="topbar-actions">
            <span className={`connection-pill connection-pill--${connectionState}`}>
              {connectionState === "online" ? "Live" : "Reconnecting"}
            </span>
            <span className="metric-chip">{submissionCount} tracked</span>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}

export default AppShell;
