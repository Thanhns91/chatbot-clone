const API_URL = "http://localhost:3000";

export const register = async (fullName, email, password) => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fullName,
      email,
      password,
    }),
  });

  return res.json();
};

export const login = async (email, password) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const data = await res.json();

  if (data.success) {
    sessionStorage.setItem("currentUser", JSON.stringify(data.user));
  }

  return data;
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
export const isStudent = () => getCurrentUser()?.role === "student";