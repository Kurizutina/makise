import React from 'react';

import {
  BrowserRouter,
  Routes,
  Route
} from 'react-router-dom';

import Login from '../Pages/auth/Login';
import Register from '../Pages/auth/Register';
import ForgotPassword from '../Pages/auth/ForgotPassword';
import ResetPassword from '../Pages/auth/ResetPassword';
import Home from '../Pages/costumer/Home';
import JollibeeMenu from '../Pages/costumer/JollibeeMenu';
import CatalogNameRedirect from '../Pages/costumer/CatalogNameRedirect';
import ProtectedRoute from './ProtectedRoute';
import RiderDashboard from '../Pages/rider/RiderDashboard';
import DeliveryAdminDashboard from '../Pages/admin/DeliveryAdminDashboard';
import CatalogBrandMenu from '../Pages/costumer/CatalogBrandMenu';

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

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute role="customer" />}>
          <Route path="/food/manuelas" element={<CatalogNameRedirect brandName="Manuela's" />} />
          <Route path="/catalog/brands/:brandId" element={<CatalogBrandMenu />} />
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
            element={<CatalogNameRedirect brandName="McDonald's" />}
          />

          <Route
            path="/food/mang-inasal"
            element={<CatalogNameRedirect brandName="Mang Inasal" />}
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
