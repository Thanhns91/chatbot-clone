import { Table, Button, Form } from 'react-bootstrap'

const ROLES = ['Admin', 'Teacher', 'Member', 'Student']

function StatusBadge({ status }) {
  return (
    <span className={`ad-status ad-status--${status}`}>
      {status}
    </span>
  )
}

function RoleSelect({ userId, currentRole, onChangeRole }) {
  return (
    <Form.Select
      className={`ad-role-select ad-role-select--${currentRole.toLowerCase()}`}
      value={currentRole}
      onChange={e => onChangeRole(userId, e.target.value)}
      size="sm"
    >
      {ROLES.map(r => (
        <option key={r} value={r}>{r}</option>
      ))}
    </Form.Select>
  )
}

export default function UserTable({ users = [], onChangeRole, onToggleBlock, onDeleteUser }) {
  const visibleUsers = users

  const formatDate = dateString => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString()
  }

  return (
    <>
      <div className="ad-panel-header">
        <div className="ad-panel-title">All Users</div>
        <div className="ad-panel-count">{visibleUsers.length} accounts</div>
      </div>

      <div className="ad-table-wrap">
        <Table className="ad-table admin-table mb-0">
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
            {visibleUsers.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name || u.fullName || '-'}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{u.email}</td>
                <td>
                  <RoleSelect
                    userId={u.id}
                    currentRole={u.role}
                    onChangeRole={onChangeRole}
                  />
                </td>
                <td style={{ color: 'var(--text-secondary)' }}>
                  {formatDate(u.joinDate || u.createdAt)}
                </td>
                <td>
                  <StatusBadge status={u.status} />
                </td>
                <td>
                  {u.status === 'active' ? (
                    <Button
                      variant="outline-danger"
                      size="sm"
                      className="ad-block-btn me-2"
                      onClick={() => onToggleBlock(u.id, u.status)}
                    >
                      <i className="bi bi-slash-circle me-1" />Block
                    </Button>
                  ) : (
                    <Button
                      variant="outline-success"
                      size="sm"
                      className="ad-unblock-btn me-2"
                      onClick={() => onToggleBlock(u.id, u.status)}
                    >
                      <i className="bi bi-check-circle me-1" />Unblock
                    </Button>
                  )}
                  <Button
                    variant="link"
                    size="sm"
                    className="ad-delete-btn text-danger p-0"
                    onClick={() => onDeleteUser(u.id)}
                  >
                    <i className="bi bi-trash me-1" />Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
    </>
  )
}