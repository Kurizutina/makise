import React from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import Login from '../Pages/auth/Login';
import Register from '../Pages/auth/Register';
import ForgotPassword from '../Pages/auth/ForgotPassword';
import ResetPassword from '../Pages/auth/ResetPassword';
import ChangePassword from '../Pages/auth/ChangePassword';
import Home from '../Pages/costumer/Home';
import JollibeeMenu from '../Pages/costumer/JollibeeMenu';
import CatalogNameRedirect from '../Pages/costumer/CatalogNameRedirect';
import ProtectedRoute from './ProtectedRoute';
import CustomerBrowseRoute from './CustomerBrowseRoute';
import RiderDashboard from '../Pages/rider/RiderDashboard';
import DeliveryAdminDashboard from '../Pages/admin/DeliveryAdminDashboard';
import CatalogBrandMenu from '../Pages/costumer/CatalogBrandMenu';
import FAQ from '../Pages/costumer/FAQ';

const AppRoutes = () => {
  return (
    <BrowserRouter>

      <Routes>

        {/* The site itself is the landing page, not a login wall - matches
            Grab/foodpanda opening straight into the browsable catalog. Goes
            through CustomerBrowseRoute like /home does, so an already-signed-in
            admin/driver still lands on their own dashboard instead of this. */}
        <Route
          path="/"
          element={<Navigate to="/home" replace />}
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
        <Route path="/change-password" element={<ChangePassword />} />

        {/* Browsing is open to guests - login is only required to actually
            place an order (gated in CustomerActivityContext/Home/CustomerActivity),
            matching how Grab/foodpanda let you look before you log in. */}
        <Route element={<CustomerBrowseRoute />}>
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

          <Route path="/faq" element={<FAQ />} />
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
