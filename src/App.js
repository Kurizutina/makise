import React from 'react';
import './App.css';
import AppRoutes from './routes/AppRoutes';
import { CustomerActivityProvider } from './context/CustomerActivityContext';

function App() {
  return (
    <CustomerActivityProvider>
      <div className="app-container">
        <AppRoutes />
      </div>
    </CustomerActivityProvider>
  );
}

export default App;
