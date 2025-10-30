import { useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { reset } from "../api/auth";

export default function ResetPassword(){
  const [params] = useSearchParams();
  const token = (params.get("token") || "").trim();
  const nav = useNavigate();

  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [err, setErr] = useState({ a:"", b:"" });
  const [toast, setToast] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setToast(""); setErr({ a:"", b:"" });
    if (p1.length < 6) return setErr(s=>({ ...s, a:"Min 6 characters" }));
    if (p1 !== p2)     return setErr(s=>({ ...s, b:"Passwords do not match" }));
    if (!token)        return setToast("Invalid or missing token.");

    const { res, data } = await reset(token, p1);
    if (!res.ok || !data?.ok) return setToast(data?.message || "Reset failed");
    setToast("Password updated. Redirecting to login…");
    setTimeout(()=> nav("/login", { replace:true }), 600);
  };

  return (
    <div className="fx-main">
      <div className="shell">
        <div className="fx-card card">
          <section>
            <div className="auth-card simple auth-simple">
              <h1 className="auth-title">Set a new password</h1>
              <form onSubmit={submit} noValidate>
                <div className="field float">
                  <input type="password" placeholder="New password" value={p1} onChange={e=>setP1(e.target.value)} />
                  {err.a && <p className="error">{err.a}</p>}
                </div>
                <div className="field float">
                  <input type="password" placeholder="Confirm new password" value={p2} onChange={e=>setP2(e.target.value)} />
                  {err.b && <p className="error">{err.b}</p>}
                </div>
                <button className="btn-primary btn-block">Reset password</button>
                <p className="auth-alt"><Link to="/login">Back to login</Link></p>
                {toast && <div className={`toast ${toast.includes("failed")?"err":"ok"}`}>{toast}</div>}
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
