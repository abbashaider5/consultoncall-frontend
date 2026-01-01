import { useEffect, useState } from 'react';
import { FaLinkedin } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import * as FiIcons from 'react-icons/fi';
import { FiBriefcase, FiEye, FiEyeOff, FiGift, FiLock, FiMail, FiPhone, FiPlus, FiUser, FiX } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import API_URL, { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

// Helper to get icon component from string
const getIcon = (iconName) => {
  if (!iconName) return null;
  const IconComponent = FiIcons[iconName];
  return IconComponent ? <IconComponent /> : null;
};

const RegisterExpert = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    title: '',
    bio: '',
    tokensPerMinute: '',
    experience: '',
    categories: [],
    skills: [],
    languages: ['English']
  });
  const [categories, setCategories] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [skillInput, setSkillInput] = useState('');
  const { registerExpert } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      // Seed categories first
      // await axios.post('/api/categories/seed').catch(() => {});
      const res = await axios.get('/api/categories');
      setCategories(res.data.data || res.data);
    } catch (error) {
      console.error('Fetch categories error:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCategoryChange = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, skillInput.trim()]
      }));
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email || !formData.password || !formData.title || !formData.bio || !formData.tokensPerMinute) {
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

    if (formData.categories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    if (formData.tokensPerMinute < 1) {
      toast.error('Rate per minute must be at least ₹1');
      return;
    }

    setLoading(true);
    const result = await registerExpert({
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      title: formData.title,
      bio: formData.bio,
      tokensPerMinute: parseInt(formData.tokensPerMinute),
      experience: parseInt(formData.experience) || 0,
      categories: formData.categories,
      skills: formData.skills,
      languages: formData.languages
    });
    setLoading(false);

    if (result.success) {
      toast.success('Expert registration successful!');
      navigate('/expert-dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: '600px' }}>
        <div className="auth-card">
          <div className="auth-header">
            <h1>Become an Expert</h1>
            <p>Create your expert profile and start earning</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="oauth-buttons">
              <button type="button" className="oauth-btn google" onClick={() => window.location.href = `${API_URL}/api/auth/google?role=expert`}>
                <FcGoogle className="oauth-icon" />
                <span>Continue with Google</span>
              </button>
              <button type="button" className="oauth-btn linkedin" onClick={() => window.location.href = `${API_URL}/api/auth/linkedin?role=expert`}>
                <FaLinkedin className="oauth-icon" />
                <span>Continue with LinkedIn</span>
              </button>
            </div>

            <div className="auth-divider">
              <span>or fill the form</span>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Full Name *</label>
                <div className="input-wrapper">
                  <FiUser className="input-icon" />
                  <input
                    type="text"
                    name="name"
                    placeholder="Your full name"
                    value={formData.name}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Email *</label>
                <div className="input-wrapper">
                  <FiMail className="input-icon" />
                  <input
                    type="email"
                    name="email"
                    placeholder="Your email"
                    value={formData.email}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Password *</label>
                <div className="input-wrapper">
                  <FiLock className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Create password"
                    value={formData.password}
                    onChange={handleChange}
                    className="input"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Confirm Password *</label>
                <div className="input-wrapper">
                  <FiLock className="input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Phone Number</label>
                <div className="input-wrapper">
                  <FiPhone className="input-icon" />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="Your phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Experience (Years)</label>
                <div className="input-wrapper">
                  <FiBriefcase className="input-icon" />
                  <input
                    type="number"
                    name="experience"
                    placeholder="Years of experience"
                    value={formData.experience}
                    onChange={handleChange}
                    className="input"
                    min="0"
                  />
                </div>
              </div>
            </div>

            <div className="form-row">
              <div className="input-group">
                <label>Professional Title *</label>
                <div className="input-wrapper">
                  <FiBriefcase className="input-icon" />
                  <input
                    type="text"
                    name="title"
                    placeholder="e.g. Senior React Developer"
                    value={formData.title}
                    onChange={handleChange}
                    className="input"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Rate Per Minute (₹) *</label>
                <div className="input-wrapper">
                  <FiGift className="input-icon" />
                  <input
                    type="number"
                    name="tokensPerMinute"
                    placeholder="e.g. 5"
                    value={formData.tokensPerMinute}
                    onChange={handleChange}
                    className="input"
                    min="1"
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label>Bio *</label>
              <textarea
                name="bio"
                placeholder="Tell us about your expertise and experience..."
                value={formData.bio}
                onChange={handleChange}
                className="input"
                rows="4"
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="input-group">
              <label>Categories * (Select at least one)</label>
              <div className="checkbox-group">
                {categories.map(category => (
                  <label key={category._id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={formData.categories.includes(category._id)}
                      onChange={() => handleCategoryChange(category._id)}
                    />
                    <span>{getIcon(category.icon)} {category.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="input-group">
              <label>Skills</label>
              <div className="skills-input">
                <input
                  type="text"
                  placeholder="Add a skill"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                  className="input"
                />
                <button type="button" className="btn btn-outline" onClick={addSkill}>
                  <FiPlus />
                </button>
              </div>
              {formData.skills.length > 0 && (
                <div className="skills-list">
                  {formData.skills.map(skill => (
                    <span key={skill} className="skill-tag">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)}>
                        <FiX />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <span className="spinner"></span> : 'Create Expert Account'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="auth-link">Sign in</Link>
            </p>
            <p>
              Just want to use the platform?{' '}
              <Link to="/register" className="auth-link">Register as User</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterExpert;
