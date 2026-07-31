import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";
import ChatLayout from "../components/Layout/ChatLayout";
import AuthButton from "../components/Auth/AuthButton";
import UserAvatar from "../components/Member/UserAvatar";
import logo7 from "../assets/images/7.png";
import Form from "react-bootstrap/Form";
import "./HomePage.scss";

const toSlug = (name = "") =>
  name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

const getStoredUser = () => {
  try {
    const rawUser =
      localStorage.getItem("currentUser") ||
      sessionStorage.getItem("currentUser");

    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.error("Cannot restore current user:", error);
    return null;
  }
};

const HomePage = () => {
  const navigate = useNavigate();

  const [message, setMessage] = useState("");
  const [currentUser, setCurrentUser] = useState(getStoredUser);

  const [conversations, setConversations] = useState([
    {
      id: "1",
      title: "hello",
      preview: "hello",
      date: "Today",
      messageCount: 2,
      starred: false,
    },
  ]);

  const [activeId, setActiveId] = useState("1");

  /**
   * QUAN TRỌNG:
   * Nếu user đã đăng nhập thì "/" chỉ là điểm trung gian.
   * Phải chuyển user sang MemberPage / TeacherPage / AdminPage.
   *
   * Nếu vừa quay về từ VNPAY thì giữ lại query:
   * ?payment=...&txnRef=...
   */
  useEffect(() => {
    if (!currentUser) return;

    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");

    let defaultPath = "/";

    if (currentUser.role === "admin") {
      defaultPath = "/admin/home";
    } else if (currentUser.role === "teacher") {
      defaultPath = "/teacher/home";
    } else {
      const slug =
        toSlug(
          currentUser.name ||
            currentUser.fullName ||
            "user",
        ) || "user";

      defaultPath = `/u/${slug}/chat`;
    }

    let returnPath = defaultPath;

    // Chỉ dùng đường dẫn đã lưu khi thực sự quay về từ VNPAY.
    if (paymentResult) {
      const savedPath = sessionStorage.getItem("vnpayReturnPath");

      const isValidSavedPath = savedPath && savedPath !== "/";

      if (isValidSavedPath) {
        returnPath = savedPath;
      } else if (currentUser.role === "student") {
        const slug =
          toSlug(
            currentUser.name ||
              currentUser.fullName ||
              "user",
          ) || "user";

        returnPath = `/u/${slug}/chat`;
      }

      sessionStorage.removeItem("vnpayReturnPath");
    }

    // Khi VNPAY return thì giữ query để SettingsModal đọc kết quả.
    const queryString = paymentResult ? window.location.search : "";

    navigate(`${returnPath}${queryString}`, {
      replace: true,
    });
  }, [currentUser, navigate]);

  const handleLoginSuccess = (role, user) => {
    setCurrentUser(user);

    localStorage.setItem(
      "currentUser",
      JSON.stringify(user),
    );

    if (role === "admin") {
      navigate("/admin/home");
      return;
    }

    if (role === "teacher") {
      navigate("/teacher/home");
      return;
    }

    const slug =
      toSlug(user.name || user.fullName) || "user";

    navigate(`/u/${slug}/chat`);
  };

  const handleLogout = () => {
    logout();

    localStorage.removeItem("currentUser");
    sessionStorage.clear();

    setCurrentUser(null);
  };

  const handleNew = () => {
    const newId = String(Date.now());

    const newConv = {
      id: newId,
      title: "New reflection",
      preview: "",
      date: "Today",
      messageCount: 0,
      starred: false,
    };

    setConversations((prev) => [
      newConv,
      ...prev,
    ]);

    setActiveId(newId);
  };

  /**
   * Phần dưới chỉ dành cho user CHƯA đăng nhập.
   *
   * User đã đăng nhập sẽ được useEffect phía trên
   * chuyển sang MemberPage, nơi có ChatArea thật.
   */
  return (
    <ChatLayout
      conversations={conversations}
      setConversations={setConversations}
      activeId={activeId}
      onSelect={setActiveId}
      onNew={handleNew}
      currentUser={currentUser}
      headerRight={
        currentUser ? (
          <UserAvatar
            user={currentUser}
            onLogout={handleLogout}
          />
        ) : (
          <AuthButton
            onLoginSuccess={handleLoginSuccess}
          />
        )
      }
    >
      <div className="homepage__body">
        <div className="homepage__welcome">
          <img
            src={logo7}
            alt="logo"
            className="homepage__logo"
          />

          <h1 className="homepage__title">
            Where should we start?
          </h1>

          <p className="homepage__subtitle">
            Ask me anything — I am here to help you
            learn and explore ideas.
          </p>
        </div>
      </div>

      <div className="homepage__input-bar">
        <button
          className="homepage__tool-btn homepage__tool-btn--attach"
          title="Attach file or image"
        >
          <i className="ti ti-paperclip" />
        </button>

        <Form.Control
          className="homepage__input"
          type="text"
          placeholder="Ask anything..."
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setMessage("");
            }
          }}
        />

        <button
          className={`homepage__send-btn ${
            message.trim()
              ? "homepage__send-btn--active"
              : ""
          }`}
        >
          <i className="ti ti-send" />
        </button>
      </div>
    </ChatLayout>
  );
};

export default HomePage;