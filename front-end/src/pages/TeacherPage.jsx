import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../services/authService";
import AdminPage from "./AdminPage";
import TeacherSidebar from "../components/Teacher/TeacherSideBar";
import HomeTab from "../components/Teacher/HomeTab";
import MaterialsTab from "../components/Teacher/MaterialsTab";
import ProfileTab from "../components/Teacher/ProfileTab";
import StudentFilesTab from "../components/Teacher/StudentFilesTab";
import StudentSummaryTab from "../components/Teacher/StudentSummaryTab";

import "../components/Teacher/Teacher.scss";

const PAGE_META = {
  home: {
    title: "Teacher Dashboard",
    sub: "AI Learning — Manage materials & student submissions",
  },
  materials: {
    title: "My Materials",
    sub: "AI Learning — Upload and manage your teaching resources",
  },
  summary: {
    title: "Student Summary",
    sub: "AI Learning — Review and chat with AI about student submissions",
  },
  "student-files": {
    title: "Student Files",
    sub: "AI Learning — Browse and manage files submitted by students",
  },
  profile: {
    title: "Profile",
    sub: "AI Learning — Manage your account and preferences",
  },
};

export default function TeacherPage() {
  const { page = "home" } = useParams();
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("currentUser"));

  const handleLogout = () => {
    logout();
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    navigate("/");
  };

  if (user?.role === "admin") {
    return <AdminPage />;
  }

  const meta = PAGE_META[page] || PAGE_META.home;

  return (
    <div className="td-root">
      <TeacherSidebar
        user={user}
        page={page}
        setPage={(id) => navigate(`/teacher/${id}`)}
        onLogout={handleLogout}
      />
      <div className="td-main">
        <header className="td-page-header">
          <h1 className="td-page-header__title">{meta.title}</h1>
          <p className="td-page-header__sub">{meta.sub}</p>
        </header>
        <main className="td-content">
          {page === "home" && <HomeTab />}
          {page === "materials" && <MaterialsTab />}
          {page === "summary" && <StudentSummaryTab />}
          {page === "student-files" && <StudentFilesTab />}
          {page === "profile" && <ProfileTab user={user} />}
        </main>
      </div>
    </div>
  );
}
