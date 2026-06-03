function AppShell({ activeView, children, connectionState, onViewChange, submissionCount }) {
  const navItems = [
    { id: "overview", label: "Overview" },
    { id: "submit", label: "Submit" },
    { id: "results", label: "My Results" },
    { id: "leaderboard", label: "Leaderboard" },
  ];

  const headings = {
    overview: {
      eyebrow: "Distributed judging platform",
      title: "Vahini evaluates submitted trading systems",
    },
    submit: {
      eyebrow: "New benchmark run",
      title: "Upload contestant package",
    },
    results: {
      eyebrow: "Live competition environment",
      title: "Submission status and benchmark results",
    },
    leaderboard: {
      eyebrow: "Live competition environment",
      title: "Ranked benchmark results",
    },
  };

  const heading = headings[activeView] || headings.overview;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">V</div>
          <div>
            <p className="eyebrow">Vahini</p>
            <h1>Judging Console</h1>
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
            <p className="eyebrow">{heading.eyebrow}</p>
            <h2>{heading.title}</h2>
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
