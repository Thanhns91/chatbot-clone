// ========================
// DEMO ACCOUNTS
// ========================
const DEMO_ACCOUNTS = [
  {
    email: 'admin@example.com',
    password: 'admin123',
    role: 'admin',
    name: 'Admin',
  },
  {
    email: 'teacher@example.com',
    password: 'teacher123',
    role: 'teacher',
    name: 'Teacher',
  },
  {
    email: 'member@example.com',
    password: 'member123',
    role: 'member',
    name: 'Member',
  },
];

// ========================
// LOGIN
// ========================
export const login = (email, password) => {
  const user = DEMO_ACCOUNTS.find(
    (acc) => acc.email === email && acc.password === password
  );

  if (!user) {
    return { success: false, message: 'Email hoặc mật khẩu không đúng.' };
  }

  // Lưu vào sessionStorage
  sessionStorage.setItem('currentUser', JSON.stringify(user));

  return { success: true, user };
};

// ========================
// LOGOUT
// ========================
export const logout = () => {
  sessionStorage.removeItem('currentUser');
};

// ========================
// GET CURRENT USER
// ========================
export const getCurrentUser = () => {
  const raw = sessionStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
};

// ========================
// CHECK ROLE
// ========================
export const isAdmin = () => getCurrentUser()?.role === 'admin';
export const isTeacher = () => getCurrentUser()?.role === 'teacher';
export const isMember = () => getCurrentUser()?.role === 'member';