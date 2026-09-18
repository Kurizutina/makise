import React from 'react';

const RoleSelector = ({
  selectedRole,
  onRoleChange,
  roles,
  mode
}) => {
  return (
    <div className="role-tabs">
      {Object.values(roles)
        .filter((role) => mode !== 'register' || role.key !== 'rider')
        .map((role) => (
        <button
          key={role.key}
          type="button"
          className={`role-tab ${
            role.key
          } ${
            selectedRole === role.key ? 'active' : ''
          }`}
          onClick={() => onRoleChange(role.key)}
          style={
            selectedRole === role.key
              ? {
                  background: role.color,
                  color:
                    role.key === 'customer'
                      ? '#1e1e1e'
                      : 'white'
                }
              : {}
          }
        >
          <i className={role.icon}></i>

          <span className="role-label">
            {role.label}
          </span>

          {role.requiresCode && (
            <i className="fas fa-lock role-lock-icon"></i>
          )}
        </button>
        ))}
    </div>
  );
};

export default RoleSelector;