import { useEffect, useState } from "react";
import { me, registerUser } from "../api/auth";
import { Link, useNavigate } from "react-router-dom";

export default function Register(){
  const nav = useNavigate();
  useEffect(()=>{ me().then(ok=>{ if(ok) nav("/", { replace:true }); }); }, [nav]);

  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", password:"", confirm:"" });
  const [err, setErr] = useState({});
  const [toast, setToast] = useState("");

  const submit = async (e) => {
    e.preventDefault(); setToast(""); setErr({});
    const { firstName, lastName, email, password, confirm } = form;
    if (!firstName) return setErr({ suFirstName:"Required" });
    if (!lastName)  return setErr({ suLastName:"Required" });
    if (!email)     return setErr({ suEmail:"Required" });
    if (!password || password.length<6) return setErr({ suPassword:"Min 6 characters" });
    if (password !== confirm) return setErr({ suPassword2:"Passwords do not match" });

    const { res, data } = await registerUser({ firstName, lastName, email: email.trim().toLowerCase(), password });
    if (!res.ok || !data?.ok){
      if (res.status===409) return setErr({ suEmail:"Email already in use" });
      return setToast(data?.message || `Registration failed (${res.status})`);
    }
    nav(`/login?email=${encodeURIComponent(email)}`, { replace:true });
  };

  const set = (k) => (e) => setForm(s => ({ ...s, [k]: e.target.value }));

  return (
    <div className="fx-main">
      <div className="shell">
        <div className="fx-card card">
          <section role="tabpanel">
            <div className="auth-card simple auth-simple">
              <h1 className="auth-title">Create an Account</h1>
              <p className="auth-sub">Sign up to access your Grade Assist dashboard</p>

              <form onSubmit={submit} noValidate>
                <div className="field float"><input placeholder="First name" value={form.firstName} onChange={set("firstName")} />{err.suFirstName && <p className="error">{err.suFirstName}</p>}</div>
                <div className="field float"><input placeholder="Last name"  value={form.lastName}  onChange={set("lastName")} />{err.suLastName && <p className="error">{err.suLastName}</p>}</div>
                <div className="field float"><input placeholder="Email"      value={form.email}     onChange={set("email")} />{err.suEmail && <p className="error">{err.suEmail}</p>}</div>
                <div className="field float pwd">
                  <input type="password" placeholder="Create password" value={form.password} onChange={set("password")} />
                  {err.suPassword && <p className="error">{err.suPassword}</p>}
                </div>
                <div className="field float pwd">
                  <input type="password" placeholder="Confirm password" value={form.confirm} onChange={set("confirm")} />
                  {err.suPassword2 && <p className="error">{err.suPassword2}</p>}
                </div>
                <button className="btn-primary btn-block">Sign up</button>
                <p className="auth-alt">Already have an account? <Link to="/login">Log in</Link></p>
                {toast && <div className="toast err">{toast}</div>}
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
