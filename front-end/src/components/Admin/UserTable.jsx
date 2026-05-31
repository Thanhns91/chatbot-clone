export default function UserTable({
  users,
  onChangeRole,
  onToggleBlock,
  onDeleteUser,
}) {
  const visibleUsers = users;

  const formatDate = (dateString) => {
    if (!dateString) return "-";

    return new Date(dateString).toLocaleDateString("en-CA");
  };

  return (
    <div className="ad-users">
      <div className="ad-users-head">
        <h2>All Users</h2>
        <span>{visibleUsers.length} accounts</span>
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {visibleUsers.map((user) => {
              const isAdmin = user.role === "admin";

              return (
                <tr key={user.userId}>
                  <td>{user.fullName}</td>
                  <td>{user.email}</td>

                  <td>
                    <select
                      className={`ad-role-select ad-role-select--${user.role}`}
                      value={user.role}
                      disabled={isAdmin}
                      onChange={(e) =>
                        onChangeRole(user.userId, e.target.value)
                      }
                    >
                      <option value="student">Student</option>
                      <option value="teacher">Teacher</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td>{formatDate(user.createdAt)}</td>

                  <td>
                    <span
                      className={`ad-status-badge ad-status-badge--${user.status}`}
                    >
                      {user.status}
                    </span>
                  </td>

                  <td>
                    {isAdmin ? (
                      <span style={{ color: "#9ca3af", fontWeight: 600 }}>
                        Protected
                      </span>
                    ) : (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className={
                            user.status === "blocked"
                              ? "ad-action-btn ad-action-btn--unblock"
                              : "ad-action-btn ad-action-btn--block"
                          }
                          onClick={() =>
                            onToggleBlock(user.userId, user.status)
                          }
                        >
                          {user.status === "blocked" ? "✓ Unblock" : "⊗ Block"}
                        </button>

                        <button
                          className="ad-action-btn"
                          style={{
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                          }}
                          onClick={() => onDeleteUser(user.userId)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
