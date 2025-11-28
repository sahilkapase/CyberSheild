import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.is_admin) {
    // Redirect non-admin users to chat instead of showing access denied
    return <Navigate to="/chat" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
