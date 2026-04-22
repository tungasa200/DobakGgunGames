import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
