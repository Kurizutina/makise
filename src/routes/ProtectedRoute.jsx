import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getDashboardPath, getSessionUser } from '../utils/session';

const ProtectedRoute = ({ role }) => {
  const location = useLocation();
  const user = getSessionUser();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // A page left in browser history may still be requested after a user signs
  // in as a different role. Redirect it to that user's own workspace rather
  // than rendering the previous account's page.
  if (role && user.role !== role) {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
