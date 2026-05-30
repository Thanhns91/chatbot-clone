const ROLES = ["Teacher", "Member"];

function StatusBadge({ status }) {
  return (
    <span className={`ad-status-badge ad-status-badge--${status}`}>
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
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}

export default function UserTable({ users, onChangeRole, onToggleBlock }) {
  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">All Users</div>
        <div className="ad-panel-count">{users.length} accounts (admin hidden)</div>
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
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: "var(--text-secondary)" }}>{u.email}</td>
                <td>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    onChangeRole={onChangeRole}
                  />
                </td>
                <td style={{ color: "var(--text-secondary)" }}>{u.joinDate}</td>
                <td><StatusBadge status={u.status} /></td>
                <td>
                  {u.status === "active" ? (
                    <button className="ad-block-btn" onClick={() => onToggleBlock(u.id)}>
                      <i className="bi bi-slash-circle" /> Block
                    </button>
                  ) : (
                    <button className="ad-unblock-btn" onClick={() => onToggleBlock(u.id)}>
                      <i className="bi bi-check-circle" /> Unblock
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}