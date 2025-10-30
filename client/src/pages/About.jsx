import { Link } from "react-router-dom";

export default function About(){
  return (
    <>
      <section className="card">
        <h3 className="card-title">What it does</h3>
        <p>
          Grade Assist converts TEAMMATES peer-evaluation data into transparent and reliable individual grades.
          You set the PA weight and number of criteria and choose a penalty for students who did not submit.
          The app processes the CSV, saves the session, and calculates PA Score, Weighted, Individual, and Final marks
          with consistent rounding. It also lets you manage group marks, review results, and export a clean CSV for your gradebook.
        </p>
      </section>

      <section className="card">
        <h3 className="card-title">How it works</h3>
        <ol>
          <li><b>Configure Grading.</b> Set PA weight, #criteria, and penalty for non-submitters.</li>
          <li><b>Attach TEAMMATES CSV.</b> We parse course/session/criteria and summary stats.</li>
          <li><b>Review &amp; Save.</b> Validate parsed counts and persist the session to the database.</li>
          <li><b>Set Group Marks.</b> Enter team marks to unlock Weighted/Individual/Final calculations.</li>
          <li><b>Export.</b> Download clean, per-student outcomes for your LMS or gradebook.</li>
        </ol>
      </section>

      <section className="card">
        <h3 className="card-title">FAQ</h3>

        <details className="ex">
          <summary>Do I need to fill Group Marks before seeing results?</summary>
          <div className="ex-body">
            Group Mark-dependent columns (Weighted/Individual/Final) need team marks. PA Score shows regardless.
          </div>
        </details>

        <details className="ex">
          <summary>Does the penalty change PA Score?</summary>
          <div className="ex-body">
            No. Penalty applies only to the Final mark when PA status is “Not Submitted”.
          </div>
        </details>

        <details className="ex">
          <summary>What rounding rules are used?</summary>
          <div className="ex-body">
            PA Score: 2 dp; other displayed marks: whole numbers. Computations use underlying precise values.
          </div>
        </details>
      </section>

      <section className="card">
        <h3 className="card-title">Contact &amp; Version</h3>
        <dl className="kv">
          <div className="kv-row"><dt>Support</dt><dd>Reach out to your course admin or the app maintainer.</dd></div>
          <div className="kv-row"><dt>Version</dt><dd>Grade Assist v1.0</dd></div>
        </dl>
      </section>

      <p style={{textAlign:"right", marginTop:8}}>
        <Link to="/login" className="nav-link" style={{textDecoration:"none"}}>Back to Home →</Link>
      </p>
    </>
  );
}
