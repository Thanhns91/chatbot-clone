const API = import.meta.env.VITE_API_URL;

export const login = async (email, password) => {
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!data.success) {
      return { success: false, message: data.message };
    }

    sessionStorage.setItem("currentUser", JSON.stringify(data.user));
    return { success: true, user: data.user };
  } catch (error) {
    return { success: false, message: "Không thể kết nối server." };
  }
};

export const logout = () => {
  sessionStorage.removeItem("currentUser");
};

export const getCurrentUser = () => {
  const raw = sessionStorage.getItem("currentUser");
  return raw ? JSON.parse(raw) : null;
};

export const isAdmin = () => getCurrentUser()?.role === "admin";
export const isTeacher = () => getCurrentUser()?.role === "teacher";
export const isMember = () => getCurrentUser()?.role === "student";
