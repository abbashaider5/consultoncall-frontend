import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, isExpert } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      toast.success('Login successful!');
      navigate(isExpert ? '/expert-dashboard' : '/');
    } else {
      toast.error(result.message);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleLinkedInLogin = () => {
    window.location.href = `${API_URL}/api/auth/linkedin`;
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Welcome Back</h1>
            <p>Sign in to your account</p>
          </div>

          <div className="oauth-buttons">
            <button type="button" className="oauth-btn google" onClick={handleGoogleLogin}>
              <FontAwesomeIcon icon={faGoogle} className="oauth-icon" />
              <span>Continue with Google</span>
            </button>
            <button type="button" className="oauth-btn linkedin" onClick={handleLinkedInLogin}>
              <FontAwesomeIcon icon={faLinkedin} className="oauth-icon" />
              <span>Continue with LinkedIn</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label>Email</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FontAwesomeIcon icon={faEyeSlash} /> : <FontAwesomeIcon icon={faEye} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Sign In'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Don't have an account?{' '}
              <Link to="/register" className="auth-link">Sign up</Link>
            </p>
            <p>
              Want to become an expert?{' '}
              <Link to="/register-expert" className="auth-link">Register as Expert</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
