import { Routes, Route, Navigate } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Upload from "./pages/Upload";
import Grades from "./pages/Grades";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Methodology from "./pages/Methodology";
import About from "./pages/About";
import { useEffect, useState } from "react";
import { me } from "./api/auth";

/* TEMP DEBUG */
console.log({
  Header, Footer, Upload, Grades, Login, Register,
  ForgotPassword, ResetPassword, Methodology, About
});
// simple auth gate: block protected pages if not logged in
function Protected({ children }) {
  const [state, setState] = useState({ loading: true, ok: false });
  useEffect(() => { me().then(ok => setState({ loading:false, ok })).catch(() => setState({ loading:false, ok:false })); }, []);
  if (state.loading) return null;
  return state.ok ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <>
      <div className="app-frame">       
      <Header />
      <main className="shell" style={{ padding: "24px 0 40px" }}>
        <Routes>
          {/* public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
          <Route path="/forgot" element={<ForgotPassword />} />
          <Route path="/reset" element={<ResetPassword />} />

          {/* protected */}
          <Route path="/" element={<Protected><Upload/></Protected>} />
          <Route path="/grades" element={<Protected><Grades/></Protected>} />
          <Route path="/methodology" element={<Protected><Methodology/></Protected>} />

          {/* will redirect to /login if not authed */}
          <Route path="*" element={<Protected><Navigate to="/" replace /></Protected>} />
        </Routes>
      </main>
      <Footer />
      </div>
    </>
  );
}
