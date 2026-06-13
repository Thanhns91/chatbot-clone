import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../services/authService";
import "../components/Admin/Admin.scss";

import Sidebar from "../components/Admin/Sidebar";
import HomeScreen from "../components/Admin/HomeScreen";
import UsersPage from "../components/Admin/UsersPage";
import DocumentsPage from "../components/Admin/DocumentsPage";
import AISettingsPage from "../components/Admin/AISettingsPage";

const PAGES = {
  home: HomeScreen,
  users: UsersPage,
  documents: DocumentsPage,
  ai: AISettingsPage,
};

export default function AdminPage() {
  const { page = "home" } = useParams();
  const navigate = useNavigate();

  const Page = PAGES[page] || HomeScreen;

  const handleNav = (id) => navigate(`/admin/${id}`);

  const handleLogout = () => {
    logout();
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div className="admin-wrapper">
      <Sidebar active={page} onNav={handleNav} onLogout={handleLogout} />
      <div className="admin-main">
        <Page />
      </div>
    </div>
  );
}
