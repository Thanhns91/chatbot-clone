const ROLES = ["Admin", "Teacher", "Member", "Student"];

function StatusBadge({ status }) {
  return (
    <span className={`ad-status ad-status--${status}`}>
      {status}
    </span>
  );
}

function RoleSelect({ userId, currentRole, onChangeRole }) {
  return (
    <select
      className={`ad-role-select ad-role-select--${currentRole.toLowerCase()}`}
      value={currentRole}
      onChange={(e) => onChangeRole(userId, e.target.value)}
    >
      {ROLES.map((r) => (
        <option key={r} value={r}>
          {r}
        </option>
      ))}
    </select>
  );
}

export default function UserTable({
  users = [],
  onChangeRole,
  onToggleBlock,
  onDeleteUser,
}) {
  const visibleUsers = users;

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">All Users</div>
        <div className="ad-panel-count">
          {visibleUsers.length} accounts
        </div>
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
            {visibleUsers.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>
                  {u.name || u.fullName || "-"}
                </td>

                <td style={{ color: "var(--text-secondary)" }}>
                  {u.email}
                </td>

                <td>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    onChangeRole={onChangeRole}
                  />
                </td>

                <td style={{ color: "var(--text-secondary)" }}>
                  {formatDate(u.joinDate || u.createdAt)}
                </td>

                <td>
                  <StatusBadge status={u.status} />
                </td>

                <td>
                  {u.status === "active" ? (
                    <button
                      className="ad-block-btn"
                      onClick={() => onToggleBlock(u.id, u.status)}
                    >
                      <i className="bi bi-slash-circle" /> Block
                    </button>
                  ) : (
                    <button
                      className="ad-unblock-btn"
                      onClick={() => onToggleBlock(u.id, u.status)}
                    >
                      <i className="bi bi-check-circle" /> Unblock
                    </button>
                  )}

                  <button
                    className="ad-delete-btn"
                    onClick={() => onDeleteUser(u.id)}
                  >
                    <i className="bi bi-trash" /> Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}