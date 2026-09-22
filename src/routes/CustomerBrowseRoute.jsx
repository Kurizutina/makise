import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getDashboardPath, getSessionUser } from '../utils/session';

// Unlike ProtectedRoute, this does NOT require a session - guests can browse
// the catalog freely (matches how Grab/foodpanda work: browse everything,
// only prompt login at cart/checkout). Still bounces an already-logged-in
// admin/driver back to their own workspace if stale browser history lands
// them on a customer page, same as ProtectedRoute does.
const CustomerBrowseRoute = () => {
  const user = getSessionUser();

  if (user && user.role !== 'customer') {
    return <Navigate to={getDashboardPath(user.role)} replace />;
  }

  return <Outlet />;
};

export default CustomerBrowseRoute;
