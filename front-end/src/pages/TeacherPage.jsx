import { useState } from "react";
import AdminPage from "./AdminPage";
import TeacherSidebar from "../components/Teacher/TeacherSidebar";
import HomeTab from "../components/Teacher/HomeTab";
import MaterialsTab from "../components/Teacher/MaterialsTab";
import ProfileTab from "../components/Teacher/ProfileTab";
import "../components/Teacher/Teacher.css";

const PAGE_META = {
  home:      { title: "Teacher Dashboard", sub: "AI Learning — Manage materials & student submissions" },
  materials: { title: "My Materials",      sub: "AI Learning — Upload and manage your teaching resources" },
  profile:   { title: "Profile",           sub: "AI Learning — Manage your account and preferences" },
};

export default function TeacherPage({ user, onLogout, onBack }) {
  const [page, setPage] = useState("home");

  if (user?.role === "admin") {
    return <AdminPage user={user} onLogout={onLogout} onBack={onBack} />;
  }

  const meta = PAGE_META[page];

  return (
    <div className="td-root">
      <TeacherSidebar
        user={user}
        page={page}
        setPage={setPage}
        onBack={onBack}
        onLogout={onLogout}
      />

      <div className="td-main">
        <div className="td-page-header">
          <button className="td-page-header__toggle">
            <i className="bi bi-layout-sidebar"></i>
          </button>
          <div>
            <h1 className="td-page-header__title">{meta.title}</h1>
            <p className="td-page-header__sub">{meta.sub}</p>
          </div>
        </div>

        <div className="td-content">
          {page === "home"      && <HomeTab />}
          {page === "materials" && <MaterialsTab />}
          {page === "profile"   && <ProfileTab user={user} />}
        </div>
      </div>
    </div>
  );
}