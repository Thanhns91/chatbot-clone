import {
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { logout } from "../services/authService";
import { getUserProfile } from "../services/api";

import AdminPage from "./AdminPage";

import TeacherSidebar from "../components/Teacher/TeacherSideBar";
import HomeTab from "../components/Teacher/HomeTab";
import MaterialsTab from "../components/Teacher/MaterialsTab";
import ProfileTab from "../components/Teacher/ProfileTab";
import StudentFilesTab from "../components/Teacher/StudentFilesTab";
import StudentSummaryTab from "../components/Teacher/StudentSummaryTab";
import MessageReportsPage from "../components/Teacher/MessageReportsPage";

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

  reports: {
    title: "Message Reports",
    sub: "AI Learning — Review reported AI answers and document issues",
  },

  profile: {
    title: "Profile",
    sub: "AI Learning — Manage your account and preferences",
  },
};

/*
 * Teacher luôn dùng Light Mode.
 *
 * Không sửa hoặc xóa theme đã lưu của Student.
 * Chỉ dọn các class Dark Mode đang còn trên DOM.
 */
const applyTeacherLightMode = () => {
  document.documentElement.setAttribute(
    "data-theme",
    "light",
  );

  document.documentElement.classList.remove(
    "dark",
    "dark-mode",
    "theme-dark",
  );

  document.body.classList.remove(
    "dark",
    "dark-mode",
    "theme-dark",
  );
};

export default function TeacherPage() {
  const { page = "home" } =
    useParams();

  const navigate = useNavigate();

  const [user, setUser] =
    useState(() => {
      try {
        const storedUser =
          localStorage.getItem(
            "currentUser",
          ) ||
          sessionStorage.getItem(
            "currentUser",
          );

        return storedUser
          ? JSON.parse(storedUser)
          : null;
      } catch {
        return null;
      }
    });

  /*
   * Mỗi khi vào Teacher Dashboard,
   * bắt buộc giao diện trở về Light Mode.
   */
  useEffect(() => {
    applyTeacherLightMode();
  }, []);

  /*
   * Khi chuyển giữa các trang Teacher,
   * tiếp tục giữ Light Mode.
   */
  useEffect(() => {
    applyTeacherLightMode();
  }, [page]);

  useEffect(() => {
    if (!user?.userId) {
      navigate("/", {
        replace: true,
      });

      return undefined;
    }

    const checkStatus = async () => {
      try {
        const result =
          await getUserProfile(
            user.userId,
          );

        if (
          result.success &&
          result.user?.status ===
            "blocked"
        ) {
          localStorage.removeItem(
            "currentUser",
          );

          sessionStorage.removeItem(
            "currentUser",
          );

          sessionStorage.setItem(
            "blockedMessage",
            "Tài khoản của bạn đã bị admin chặn.",
          );

          setUser(null);

          navigate("/", {
            replace: true,
          });
        }
      } catch (error) {
        console.log(
          "Cannot check teacher status:",
          error,
        );
      }
    };

    checkStatus();

    const timer = setInterval(
      checkStatus,
      5000,
    );

    return () => {
      clearInterval(timer);
    };
  }, [user?.userId, navigate]);

  const handleUserUpdated = (
    updatedUser,
  ) => {
    const finalUser = {
      ...updatedUser,

      name:
        updatedUser.name ||
        updatedUser.fullName ||
        user?.name,

      fullName:
        updatedUser.fullName ||
        updatedUser.name ||
        user?.fullName,

      avatar_url:
        updatedUser.avatar_url ||
        updatedUser.avatarUrl ||
        "",

      avatarUrl:
        updatedUser.avatarUrl ||
        updatedUser.avatar_url ||
        "",
    };

    setUser(finalUser);

    if (
      localStorage.getItem(
        "currentUser",
      )
    ) {
      localStorage.setItem(
        "currentUser",
        JSON.stringify(finalUser),
      );
    }

    if (
      sessionStorage.getItem(
        "currentUser",
      )
    ) {
      sessionStorage.setItem(
        "currentUser",
        JSON.stringify(finalUser),
      );
    }
  };

  const handleLogout = () => {
    logout();

    localStorage.removeItem(
      "currentUser",
    );

    sessionStorage.clear();

    applyTeacherLightMode();

    navigate("/");
  };

  if (!user) {
    return null;
  }

  /*
   * Admin cũng phải luôn Light Mode.
   * AdminPage sẽ được sửa thêm ở file riêng.
   */
  if (user.role === "admin") {
    applyTeacherLightMode();

    return <AdminPage />;
  }

  if (user.role !== "teacher") {
    navigate("/", {
      replace: true,
    });

    return null;
  }

  const activePage =
    PAGE_META[page]
      ? page
      : "home";

  const meta =
    PAGE_META[activePage];

  return (
    <div className="td-root">
      <TeacherSidebar
        user={user}
        page={activePage}
        setPage={(id) =>
          navigate(`/teacher/${id}`)
        }
        onLogout={handleLogout}
      />

      <div className="td-main">
        <header className="td-page-header">
          <h1 className="td-page-header__title">
            {meta.title}
          </h1>

          <p className="td-page-header__sub">
            {meta.sub}
          </p>
        </header>

        <main className="td-content">
          {activePage === "home" && (
            <HomeTab />
          )}

          {activePage ===
            "materials" && (
            <MaterialsTab />
          )}

          {activePage ===
            "summary" && (
            <StudentSummaryTab />
          )}

          {activePage ===
            "student-files" && (
            <StudentFilesTab />
          )}

          {activePage ===
            "reports" && (
            <MessageReportsPage
              user={user}
            />
          )}

          {activePage ===
            "profile" && (
            <ProfileTab
              user={user}
              onUserUpdated={
                handleUserUpdated
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}