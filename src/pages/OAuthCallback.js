import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { handleOAuthCallback } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const redirect = searchParams.get('redirect') || '/';

    if (error) {
      toast.error('OAuth authentication failed. Please try again.');
      navigate('/login');
      return;
    }

    if (token) {
      handleOAuthCallback(token).then((success) => {
        if (success) {
          toast.success('Login successful!');
          navigate(redirect);
        } else {
          toast.error('Authentication failed');
          navigate('/login');
        }
      });
    } else {
      navigate('/login');
    }
  }, [searchParams, navigate, handleOAuthCallback]);

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center', padding: '3rem' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <h2 style={{ color: '#374151', marginBottom: '0.5rem' }}>Authenticating...</h2>
          <p style={{ color: '#6b7280' }}>Please wait while we complete your login.</p>
        </div>
      </div>
    </div>
  );
};

export default OAuthCallback;
