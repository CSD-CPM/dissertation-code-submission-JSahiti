import { useState } from "react";
import { forgot } from "../api/auth";
import { Link } from "react-router-dom";

export default function ForgotPassword(){
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setErr(""); setToast("");
    if (!email) { setErr("Email is required"); return; }
    const { res } = await forgot(email.trim().toLowerCase());
    setToast("If an account exists for that email, a reset link was sent.");
    if (!res.ok) setToast("Could not send reset link. Try again.");
  };

  return (
    <div className="fx-main">
      <div className="shell">
        <div className="fx-card card">
          <section>
            <div className="auth-card simple auth-simple">
              <h1 className="auth-title">Forgot your password?</h1>
              <p className="auth-sub">Enter your email and we’ll send a reset link.</p>
              <form onSubmit={submit} noValidate>
                <div className="field float">
                  <input placeholder="Your email" value={email} onChange={e=>{ setEmail(e.target.value); setErr(""); }} />
                  {err && <p className="error">{err}</p>}
                </div>
                <button className="btn-primary btn-block">Send reset link</button>
                <p className="auth-alt">Remembered it? <Link to="/login">Log in</Link></p>
                {toast && <div className={`toast ${err ? "err":"ok"}`}>{toast}</div>}
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
