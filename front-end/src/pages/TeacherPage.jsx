import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { logout } from "../services/authService";
import { getUserProfile } from "../services/api";

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

const applyStoredTheme = () => {
  const theme = localStorage.getItem("theme") === "dark" ? "dark" : "light";

  document.documentElement.setAttribute("data-theme", theme);

  if (theme === "dark") {
    document.body.classList.add("dark", "theme-dark");
  } else {
    document.body.classList.remove("dark", "dark-mode", "theme-dark");
  }
};

export default function TeacherPage() {
  const { page = "home" } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(() =>
    JSON.parse(
      localStorage.getItem("currentUser") ||
        sessionStorage.getItem("currentUser") ||
        "null",
    ),
  );

  useEffect(() => {
    applyStoredTheme();

    const syncTheme = () => applyStoredTheme();
    window.addEventListener("storage", syncTheme);

    return () => window.removeEventListener("storage", syncTheme);
  }, []);

  useEffect(() => {
    if (!user?.userId) {
      navigate("/", { replace: true });
      return undefined;
    }

    const checkStatus = async () => {
      try {
        const result = await getUserProfile(user.userId);

        if (result.success && result.user?.status === "blocked") {
          localStorage.removeItem("currentUser");
          sessionStorage.removeItem("currentUser");
          sessionStorage.setItem(
            "blockedMessage",
            "Tài khoản của bạn đã bị admin chặn.",
          );

          setUser(null);
          navigate("/", { replace: true });
        }
      } catch (error) {
        console.log("Cannot check teacher status:", error);
      }
    };

    checkStatus();
    const timer = setInterval(checkStatus, 5000);

    return () => clearInterval(timer);
  }, [user?.userId, navigate]);

  const handleUserUpdated = (updatedUser) => {
    const finalUser = {
      ...updatedUser,
      name: updatedUser.name || updatedUser.fullName || user?.name,
      fullName: updatedUser.fullName || updatedUser.name || user?.fullName,
      avatar_url: updatedUser.avatar_url || updatedUser.avatarUrl || "",
      avatarUrl: updatedUser.avatarUrl || updatedUser.avatar_url || "",
    };

    setUser(finalUser);

    if (localStorage.getItem("currentUser")) {
      localStorage.setItem("currentUser", JSON.stringify(finalUser));
    }

    if (sessionStorage.getItem("currentUser")) {
      sessionStorage.setItem("currentUser", JSON.stringify(finalUser));
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem("currentUser");
    sessionStorage.clear();
    navigate("/");
  };

  if (!user) return null;

  if (user.role === "admin") {
    return <AdminPage />;
  }

  if (user.role !== "teacher") {
    navigate("/", { replace: true });
    return null;
  }

  const activePage = PAGE_META[page] ? page : "home";
  const meta = PAGE_META[activePage];

  return (
    <div className="td-root">
      <TeacherSidebar
        user={user}
        page={activePage}
        setPage={(id) => navigate(`/teacher/${id}`)}
        onLogout={handleLogout}
      />

      <div className="td-main">
        <header className="td-page-header">
          <h1 className="td-page-header__title">{meta.title}</h1>
          <p className="td-page-header__sub">{meta.sub}</p>
        </header>

        <main className="td-content">
          {activePage === "home" && <HomeTab />}
          {activePage === "materials" && <MaterialsTab />}
          {activePage === "summary" && <StudentSummaryTab />}
          {activePage === "student-files" && <StudentFilesTab />}
          {activePage === "profile" && (
            <ProfileTab user={user} onUserUpdated={handleUserUpdated} />
          )}
        </main>
      </div>
    </div>
  );
}