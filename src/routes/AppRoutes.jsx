import React from 'react';

import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import Login from '../Pages/auth/Login';
import Register from '../Pages/auth/Register';
import Home from '../Pages/costumer/Home';
import JollibeeMenu from '../Pages/costumer/JollibeeMenu';
import McDonaldsMenu from '../Pages/costumer/McDonaldsMenu';
import MangInasalMenu from '../Pages/costumer/MangInasalMenu';
import ManuelasMenu from '../Pages/costumer/ManuelasMenu';
import ProtectedRoute from './ProtectedRoute';
import RiderDashboard from '../Pages/rider/RiderDashboard';
import DeliveryAdminDashboard from '../Pages/admin/DeliveryAdminDashboard';

const AppRoutes = () => {
  return (
    <BrowserRouter>

      <Routes>

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/login"
          element={<Login />}
        />

        <Route
          path="/register"
          element={<Register />}
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/food/manuelas" element={<ManuelasMenu />} />
          <Route
            path="/home"
            element={<Home />}
          />

          <Route
            path="/food/jollibee"
            element={<JollibeeMenu />}
          />

          <Route
            path="/food/mcdonalds"
            element={<McDonaldsMenu />}
          />

          <Route
            path="/food/mang-inasal"
            element={<MangInasalMenu />}
          />
        </Route>

        <Route element={<ProtectedRoute role="driver" />}>
          <Route
            path="/rider/orders"
            element={<RiderDashboard />}
          />
        </Route>
        <Route element={<ProtectedRoute role="admin" />}>
          <Route
            path="/admin/dashboard"
            element={<DeliveryAdminDashboard />}
          />
        </Route>

      </Routes>

    </BrowserRouter>
  );
};

export default AppRoutes;
