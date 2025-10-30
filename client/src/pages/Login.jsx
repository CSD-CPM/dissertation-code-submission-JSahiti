import { useEffect, useState } from "react";
import { login, me } from "../api/auth";
import { useNavigate, useSearchParams, Link } from "react-router-dom";

export default function Login(){
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState({ email:"", password:"" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    me().then(ok => { if (ok) nav("/", { replace:true }); });
  }, [nav]);

  const onSubmit = async (e) => {
    e.preventDefault(); setToast(""); setErr({ email:"", password:"" });
    if (!email)  return setErr(s => ({...s, email:"Email is required"}));
    if (!password) return setErr(s => ({...s, password:"Password is required"}));
    const { res, data } = await login(email.trim().toLowerCase(), password);
    if (!res.ok || !data?.ok){
      if (res.status===400 || res.status===401) return setErr(s => ({...s, password:"Incorrect email or password"}));
      return setToast(data?.message || `Login failed (${res.status})`);
    }
    if (data.token || data.accessToken) sessionStorage.setItem("ga_token", data.token || data.accessToken);
    nav("/", { replace:true });
  };

  return (
    <div className="fx-main">
      <div className="shell">
        <div className="fx-card card">
          <section role="tabpanel">
            <div className="auth-card simple auth-simple">
              <h1 className="auth-title">Welcome back!</h1>
              <p className="auth-sub">Sign in to access your Grade Assist dashboard</p>
              <form onSubmit={onSubmit} noValidate>
                <div className="field float">
                  <input value={email} onChange={e=>{ setEmail(e.target.value); setErr(s=>({...s, email:""})); }} placeholder="Email" autoComplete="username" />
                  {err.email && <p className="error">{err.email}</p>}
                </div>
                <div className="field float pwd">
                  <input type="password" value={password} onChange={e=>{ setPassword(e.target.value); setErr(s=>({...s, password:""})); }}
                         placeholder="Password" autoComplete="current-password" />
                  {err.password && <p className="error">{err.password}</p>}
                </div>
                <div className="fx-actions">
                  <Link className="forgot-link" to="/forgot">Forgot password?</Link>
                </div>
                <button className="btn-primary btn-block" id="loginButton">Login</button>
                <p className="auth-alt">Don’t have an account? <Link to="/register">Sign up</Link></p>
                {toast && <div className="toast err">{toast}</div>}
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
