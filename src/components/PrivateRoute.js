import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children, expertOnly = false, adminOnly = false }) => {
  const { isAuthenticated, isExpert, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && user?.role !== 'admin') {
    return <Navigate to="/" />;
  }

  if (expertOnly && !isExpert && user?.role !== 'admin') {
    return <Navigate to="/dashboard" />;
  }

  return children;
};

export default PrivateRoute;
