import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faEnvelope, faPhone, faUser } from '@fortawesome/free-solid-svg-icons';
import { faLinkedin, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API_URL from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await register({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone
    });
    setLoading(false);

    if (result.success) {
      toast.success('Registration successful!');
      navigate('/');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>Create Account</h1>
            <p>Join as a user to connect with experts</p>
          </div>

          <div className="oauth-buttons">
            <button type="button" className="oauth-btn google" onClick={() => window.location.href = `${API_URL}/api/auth/google`}>
              <FontAwesomeIcon icon={faGoogle} className="oauth-icon" />
              <span>Continue with Google</span>
            </button>
            <button type="button" className="oauth-btn linkedin" onClick={() => window.location.href = `${API_URL}/api/auth/linkedin`}>
              <FontAwesomeIcon icon={faLinkedin} className="oauth-icon" />
              <span>Continue with LinkedIn</span>
            </button>
          </div>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="input-group">
              <label>Full Name *</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faUser} className="input-icon" />
                <input
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Email *</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                <input
                  type="email"
                  name="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Phone Number</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faPhone} className="input-icon" />
                <input
                  type="tel"
                  name="phone"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            <div className="input-group">
              <label>Password *</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleChange}
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

            <div className="input-group">
              <label>Confirm Password *</label>
              <div className="input-wrapper">
                <FontAwesomeIcon icon={faLock} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="input"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Create Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
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

export default Register;
