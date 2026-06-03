import heroImage from "../assets/hero.png";

function OverviewPanel({ onStart }) {
  return (
    <section className="overview">
      <div className="overview-hero">
        <div className="overview-copy">
          <p className="eyebrow">Vahini</p>
          <h3>Judging trading engines through flow, pressure, and proof.</h3>
          <p>
            Vahini hosts contestant code in isolated containers, drives it with
            concurrent order traffic, validates exchange behavior, and streams
            benchmark results into a live leaderboard.
          </p>
          <button className="button button--primary" onClick={onStart} type="button">
            Submit package
          </button>
        </div>
        <img alt="Benchmark flow" className="overview-visual" src={heroImage} />
      </div>

      <div className="overview-grid">
        <article>
          <span>01</span>
          <h4>Upload</h4>
          <p>Contestants submit a ZIP containing a matching engine or orderbook service.</p>
        </article>
        <article>
          <span>02</span>
          <h4>Isolate</h4>
          <p>The platform builds a Docker image and runs the service with CPU and memory limits.</p>
        </article>
        <article>
          <span>03</span>
          <h4>Judge</h4>
          <p>Correctness checks verify fills, remaining book state, and invalid order handling.</p>
        </article>
        <article>
          <span>04</span>
          <h4>Benchmark</h4>
          <p>The bot fleet measures throughput, failure rate, and p50/p90/p99 latency.</p>
        </article>
      </div>
    </section>
  );
}

export default OverviewPanel;
