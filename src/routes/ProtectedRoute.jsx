import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getSessionUser } from '../utils/session';

const ProtectedRoute = ({ role }) => {
  const location = useLocation();
  const token = sessionStorage.getItem('otuzanAuthenticated');

  if (!token || (role && getSessionUser()?.role !== role)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
