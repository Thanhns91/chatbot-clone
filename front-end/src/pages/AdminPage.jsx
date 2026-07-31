import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../services/authService";

import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "../components/Admin/Admin.scss";

import Sidebar from "../components/Admin/Sidebar";
import HomeScreen from "../components/Admin/HomeScreen";
import UsersPage from "../components/Admin/UsersPage";
import DocumentsPage from "../components/Admin/DocumentsPage";

const PAGES = {
  home: HomeScreen,
  users: UsersPage,
  documents: DocumentsPage,
};

export default function AdminPage() {
  const { page = "home" } = useParams();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem("admin_sidebar_collapsed") === "true",
  );

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("admin_sidebar_collapsed", String(next));
      return next;
    });
  };

  const Page = PAGES[page] || HomeScreen;

  const handleNav = (id) => {
    navigate(`/admin/${id}`);
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    navigate("/");
  };

  return (
    <div className={`admin-wrapper ${sidebarCollapsed ? "admin-wrapper--collapsed" : ""}`}>
      <Sidebar
        active={page}
        onNav={handleNav}
        onLogout={handleLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      <main className="admin-main">
        <Page sidebarCollapsed={sidebarCollapsed} onToggleSidebar={handleToggleSidebar} />
      </main>
    </div>
  );
}