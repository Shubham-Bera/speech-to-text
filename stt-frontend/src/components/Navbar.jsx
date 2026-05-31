import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function Navbar() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    toast.success("Logged out successfully.");
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <a className="nav-brand" href="/dashboard">
        <span>🎙️</span> STT App
      </a>

      <div className="nav-right">
        <span className="nav-user">
          Signed in as <strong>{user.name || "User"}</strong>
        </span>
        <button className="btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
}