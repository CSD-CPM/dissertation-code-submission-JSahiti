import { useEffect } from "react";

export default function Methodology(){

  // Sticky ToC highlighting + precise scrolling with header offset
  useEffect(() => {
    const links = Array.from(document.querySelectorAll(".toc-link"));
    const getTarget = (a) => {
      const href = (a.getAttribute("href") || "").trim();
      if (!href.startsWith("#")) return null;
      try { return document.querySelector(href); } catch { return null; }
    };
    const sections = links.map(getTarget).filter(Boolean);
    const HEADER_OFFSET = 84;
    let observerPaused = false;

    const setActive = (id) => {
      links.forEach(a => a.classList.toggle("active", a.getAttribute("href") === id));
    };
    const pauseObserver = (ms = 450) => { observerPaused = true; setTimeout(() => { observerPaused = false; }, ms); };
    const scrollToWithOffset = (el) => {
      const top = window.scrollY + el.getBoundingClientRect().top - HEADER_OFFSET;
      window.scrollTo({ top, behavior: "smooth" });
    };

    links.forEach(a => {
      a.addEventListener("click", (e) => {
        const target = getTarget(a);
        if (!target) return;
        e.preventDefault();
        pauseObserver();
        setActive(a.getAttribute("href"));
        history.replaceState(null, "", a.getAttribute("href"));
        scrollToWithOffset(target);
      });
    });

    const io = new IntersectionObserver((entries) => {
      if (observerPaused) return;
      const viewportTop = window.scrollY + HEADER_OFFSET + 1;
      const visible = entries
        .filter(e => e.isIntersecting)
        .map(e => ({
          el: e.target,
          dist: Math.abs((window.scrollY + e.target.getBoundingClientRect().top) - viewportTop)
        }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (visible) setActive("#" + visible.el.id);
    }, {
      root: null,
      rootMargin: `-${HEADER_OFFSET + 10}px 0px -70% 0px`,
      threshold: [0, 0.1, 0.2, 0.4, 0.6, 1]
    });

    sections.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);

  return (
    <div className="doc-modern">
      {/* Hero */}
      <section className="hero">
        <h1>How are grades calculated?</h1>
        <p>Transparent formulas, consistent rounding, and clear handling of PA not submitted.</p>
        <div className="meta-row">
          <span className="meta-chip">PA Score: 2 dp</span>
          <span className="meta-chip">All other marks: whole</span>
          <span className="meta-chip">Penalty applies only to Final Mark</span>
        </div>
      </section>

      <div className="layout">
        {/* Sticky in-page nav */}
        <aside className="toc">
          <h4>On this page</h4>
          <a href="#columns"  className="toc-link active">Column meanings</a>
          <a href="#formulas" className="toc-link">Formulas</a>
          <a href="#rounding" className="toc-link">Rounding rules</a>
          <a href="#examples" className="toc-link">Worked examples</a>
          <a href="#edge"     className="toc-link">Edge cases</a>
        </aside>

        {/* Content */}
        <div>
          <section id="columns" className="card" aria-labelledby="col-meanings-title">
            <h2 id="col-meanings-title" className="card-title">Column meanings</h2>
            <p className="muted" style={{margin:"4px 0 14px"}}>What each column tells you.</p>

            <div className="info-grid">
              <article className="info-card">
                <div className="info-head"><h3>Average Points</h3></div>
                <p>
                  Average points the student received from teammates per criterion,
                  then averaged across all criteria (0-100).
                </p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>PA Score</h3></div>
                <p>
                  Relative share of contribution within the team.
                  <span className="chip tip">≈1.00</span> is team average,
                  <span className="chip tip">&gt;1</span> above-average,
                  <span className="chip tip">&lt;1</span> below-average.
                </p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>Group Mark</h3></div>
                <p>
                  Team result for the deliverable (0-100), configured per team in the
                  <em> Group Mark Configuration</em> box.
                </p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>Weighted Mark</h3></div>
                <p>“If PA were 100%”:</p>
                <p className="formula"><code>Group&nbsp;Mark × PA&nbsp;Score</code></p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>Individual Mark</h3></div>
                <p>Blends contribution and team result using your PA Weight:</p>
                <p className="formula">
                  <code>(Weighted&nbsp;Mark × PA%) + (Group&nbsp;Mark × (1 − PA%))</code>
                </p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>PA Status</h3></div>
                <p>Submission status:</p>
                <p>
                  <span className="badge good">Submitted</span>
                  <span className="sep">/</span>
                  <span className="badge bad">Not Submitted</span>
                </p>
              </article>

              <article className="info-card">
                <div className="info-head"><h3>Final Mark</h3></div>
                <p>
                  Equals <strong>Individual Mark</strong> unless PA was not submitted.
                  If <em>Not Submitted</em>, a penalty is applied to the <strong>Individual Mark</strong>
                  to produce the final mark.
                </p>
              </article>
            </div>
          </section>

          <section id="formulas" className="section">
            <h2>Formulas<a className="anchor" href="#formulas">#</a></h2>
            <p className="lead">Exact definitions used by the app.</p>

            <p><b>PA Score</b></p>
            <p className="formula">PA Score = (Average Points ÷ Number of Criteria) ÷ (100 ÷ Group Size)</p>

            <p><b>Weighted Mark</b></p>
            <p className="formula">Weighted Mark = Group Mark × PA Score</p>

            <p><b>Individual Mark</b></p>
            <p className="formula">Individual Mark = (Weighted Mark × PA%) + (Group Mark × (1 − PA%))</p>

            <p><b>Final Mark</b></p>
            <p className="formula">Final Mark = Individual Mark − (Individual Mark × Penalty%)&nbsp; (only if PA is Not Submitted)</p>

            <div className="callout">
              <b>Note:</b> Penalty never changes the PA Score. It reduces the <em>Final Mark</em> from the computed <em>Individual Mark</em>.
            </div>
          </section>

          <section id="rounding" className="section">
            <h2>Rounding rules<a className="anchor" href="#rounding">#</a></h2>
            <ul>
              <li><b>PA Score</b>: 2 decimal places (e.g., 1.286 → 1.29).</li>
              <li><b>Weighted Mark</b>, <b>Individual Mark</b>, <b>Final Mark</b>, <b>Group Mark</b>: rounded to the nearest whole number for display.</li>
              <li>Calculations use the underlying values; rounding is applied for presentation consistency.</li>
            </ul>
          </section>

          <section id="examples" className="section">
            <h2>Worked examples<a className="anchor" href="#examples">#</a></h2>

            <details className="ex">
              <summary>Example A — 4-person team, no penalty</summary>
              <div className="ex-body">
                <div className="pill"><b>Inputs:</b> Average Points 132.00, Group Size 4, #Criteria 4, Group Mark 80, PA% 40</div>
                <div>PA Score = (132/4) ÷ (100/4) = 33 ÷ 25 = <b>1.32</b></div>
                <div>Weighted Mark = 80 × 1.32 = <b>105.6 → 106</b></div>
                <div>Individual Mark = (106 × 0.40) + (80 × 0.60) = 42.4 + 48 = <b>90.4 → 90</b></div>
                <div>Final Mark = <b>90</b> (no penalty)</div>
              </div>
            </details>

            <details className="ex">
              <summary>Example B — 5-person team, “Not Submitted” with 10% penalty</summary>
              <div className="ex-body">
                <div className="pill"><b>Inputs:</b> Average Points 86.50, Group Size 5, #Criteria 4, Group Mark 91, PA% 30, Penalty 10%</div>
                <div>PA Score = (86.5/4) ÷ (100/5) = 21.625 ÷ 20 = <b>1.08125 → 1.08</b></div>
                <div>Weighted Mark = 91 × 1.08 = <b>98.28 → 98</b></div>
                <div>Individual Mark = (98 × 0.30) + (91 × 0.70) = 29.4 + 63.7 = <b>93.1 → 93</b></div>
                <div>Final Mark = 93 − (93 × 0.10) = 83.7 → <b>84</b></div>
              </div>
            </details>
          </section>

          <section id="edge" className="section">
            <h2>Edge cases<a className="anchor" href="#edge">#</a></h2>
            <ul>
              <li><b>Missing Group Mark:</b> PA Score is shown; marks depending on Group Mark display once you set it.</li>
              <li><b>No criteria / zero group size:</b> PA Score falls back to 1.00 for safety; update configuration to compute properly.</li>
              <li><b>Penalty:</b> applied only if PA status is “Not Submitted”, and only to the <b>Final Mark</b>.</li>
            </ul>
            <div className="callout">
              Need the raw figures behind a student’s PA Score? Export CSV from the Grades page.
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
