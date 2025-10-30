import { Link, useLocation, useNavigate } from "react-router-dom";
import { logout } from "../api/auth";

const PUBLIC = ["/login", "/register", "/forgot", "/reset", "/about"];

export default function Header() {
  const { pathname } = useLocation();
  const nav = useNavigate();
  const isPublic = PUBLIC.includes(pathname);
  const isAbout = pathname === "/about";

  // Helper to return the correct subtitle under the logo
  const getSubtitle = () => {
    switch (pathname) {
      case "/login":
        return "Homepage";
      case "/register":
        return "Register";
      case "/about":
        return "About";
      case "/methodology":
        return "Methodology";
      case "/grades":
        return "Group Mark & Breakdown";
      default:
        return "Grade Configuration & CSV Upload";
    }
  };

  return (
    <header className="site-header" role="banner">
      <div className="shell">
        {/* Brand / logo */}
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <img src="/logo.svg" alt="" />
          </div>
          <div className="brand-text">
            <strong>Grade Assist</strong>
            <span>{getSubtitle()}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="site-nav">
          {isPublic ? (
            <>
              {isAbout ? (
                <Link className="nav-link" to="/login">
                  Back to Home
                </Link>
              ) : (
                <Link className="nav-link" to="/about">
                  About
                </Link>
              )}
            </>
          ) : (
            <>
              <Link className="nav-link" to="/">
                Upload
              </Link>
              <Link className="nav-link" to="/methodology">
                Methodology
              </Link>
              <a
                className="nav-link"
                href="#logout"
                onClick={async (e) => {
                  e.preventDefault();
                  await logout();
                  nav("/login");
                }}
              >
                Log out
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
