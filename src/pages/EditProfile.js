import { useEffect, useState } from 'react';
import { FiCamera, FiGlobe, FiMail, FiPhone, FiSave, FiUser } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import DashboardLayout from '../components/DashboardLayout';
import { axiosInstance as axios } from '../config/api';
import { useAuth } from '../context/AuthContext';
import './EditProfile.css';

const EditProfile = () => {
  const navigate = useNavigate();
  const { user, expert, updateUser, updateExpert, isExpert } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [categories, setCategories] = useState([]);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameMessage, setUsernameMessage] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    phone: '',
    country: '',
    bio: '',
    avatar: ''
  });

  const [expertData, setExpertData] = useState({
    title: '',
    bio: '',
    tokensPerMinute: 5,
    experience: 0,
    skills: [],
    languages: [],
    categories: []
  });

  const [newSkill, setNewSkill] = useState('');
  const [newLanguage, setNewLanguage] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        phone: user.phone || '',
        country: user.country || '',
        bio: user.bio || '',
        avatar: user.avatar || ''
      });
    }
    if (expert) {
      setExpertData({
        title: expert.title || '',
        bio: expert.bio || '',
        tokensPerMinute: expert.tokensPerMinute || 5,
        experience: expert.experience || 0,
        skills: expert.skills || [],
        languages: expert.languages || [],
        categories: expert.categories?.map(c => c._id) || []
      });
    }
  }, [user, expert]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get('/api/categories');
        setCategories(res.data.data || res.data);
      } catch (error) {
        console.error('Failed to fetch categories');
      }
    };
    if (isExpert) {
      fetchCategories();
    }
  }, [isExpert]);

  // Debounced username availability check
  const checkUsernameAvailability = async (username) => {
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      setUsernameMessage('');
      return;
    }

    setUsernameChecking(true);
    try {
      const res = await axios.get(`/api/users/check-username/${username}`);
      setUsernameAvailable(res.data.available);
      setUsernameMessage(res.data.message);
    } catch (error) {
      setUsernameAvailable(false);
      setUsernameMessage(error.response?.data?.message || 'Error checking username');
    } finally {
      setUsernameChecking(false);
    }
  };

  // Debounce the username check
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      checkUsernameAvailability(formData.username);
    }, 500); // 500ms delay

    return () => clearTimeout(debounceTimer);
  }, [formData.username]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleExpertChange = (e) => {
    const { name, value, type } = e.target;
    setExpertData({
      ...expertData,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    });
  };

  const handleCategoryChange = (categoryId) => {
    setExpertData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !expertData.skills.includes(newSkill.trim())) {
      setExpertData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill) => {
    setExpertData(prev => ({
      ...prev,
      skills: prev.skills.filter(s => s !== skill)
    }));
  };

  const addLanguage = () => {
    if (newLanguage.trim() && !expertData.languages.includes(newLanguage.trim())) {
      setExpertData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const removeLanguage = (lang) => {
    setExpertData(prev => ({
      ...prev,
      languages: prev.languages.filter(l => l !== lang)
    }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingAvatar(true);
    setUploadProgress(0);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('avatar', file);

      const token = localStorage.getItem('token');

      // Show upload start notification
      const uploadToast = toast.info('Uploading avatar...', {
        autoClose: false,
        closeOnClick: false,
        draggable: false
      });

      const res = await axios.post('/api/users/upload-avatar', formDataUpload, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'x-auth-token': token
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);

          // Update toast with progress
          toast.update(uploadToast, {
            render: `Uploading avatar... ${percentCompleted}%`,
            type: 'info'
          });
        }
      });

      // Dismiss the upload toast and show success
      toast.dismiss(uploadToast);
      setFormData(prev => ({ ...prev, avatar: res.data.avatar }));
      toast.success('Avatar uploaded successfully!');
      setUploadProgress(100);
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to upload avatar');
      setUploadProgress(0);
    } finally {
      setUploadingAvatar(false);
      // Clear progress after a short delay
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check if username is available before submitting
    if (formData.username && usernameAvailable === false) {
      toast.error('Please choose an available username');
      return;
    }
    
    setLoading(true);

    try {
      // Update user profile
      const userRes = await axios.put('/api/users/profile', formData);
      updateUser(userRes.data);

      // Update expert profile if user is an expert
      if (isExpert) {
        const expertRes = await axios.put('/api/experts/profile', expertData);
        updateExpert(expertRes.data);
      }

      toast.success('Profile updated successfully!');
      navigate(isExpert ? '/expert-dashboard' : '/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Edit Profile">
      <div className="edit-profile-content">
        <div className="edit-profile-header">
          <h1>Edit Profile</h1>
          <p>Update your personal information</p>
        </div>

        <form onSubmit={handleSubmit} className="edit-profile-form">
          {/* Avatar Section */}
          <div className="profile-avatar-section">
            <div className="avatar-preview">
              {formData.avatar ? (
                <img src={formData.avatar} alt={formData.name} />
              ) : (
                <span>{formData.name?.charAt(0)?.toUpperCase() || '?'}</span>
              )}
              <label className="avatar-upload" title="Upload image">
                {uploadingAvatar ? (
                  <span className="upload-spinner"></span>
                ) : (
                  <FiCamera />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  style={{ display: 'none' }}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>
            <div className="avatar-options">
              <span className="avatar-hint">Click the camera icon to upload an image, or enter a URL below:</span>
              {uploadingAvatar && uploadProgress > 0 && (
                <div className="upload-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <span className="progress-text">{uploadProgress}%</span>
                </div>
              )}
              <input
                type="text"
                name="avatar"
                value={formData.avatar}
                onChange={handleChange}
                placeholder="Enter avatar URL (e.g., https://example.com/photo.jpg)"
                className="input avatar-url-input"
              />
            </div>
          </div>

          {/* Basic Info */}
          <div className="form-section">
            <h2>Basic Information</h2>
            <div className="form-grid">
              <div className="input-group">
                <label><FiUser /> Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input"
                  required
                />
              </div>
              <div className="input-group">
                <label><FiUser /> Username</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  className={`input ${usernameAvailable === false ? 'input-error' : usernameAvailable === true ? 'input-success' : ''}`}
                  placeholder="e.g., johnsmith"
                  pattern="^[a-z0-9_]+$"
                  minLength="3"
                  maxLength="30"
                />
                <div className="username-status">
                  {usernameChecking && <span className="checking">Checking availability...</span>}
                  {usernameAvailable === true && <span className="available">✓ {usernameMessage}</span>}
                  {usernameAvailable === false && <span className="unavailable">✗ {usernameMessage}</span>}
                </div>
                <span className="input-hint">Lowercase letters, numbers, and underscores only. {formData.username && `Profile URL: /expert/${formData.username}`}</span>
              </div>
              <div className="input-group">
                <label><FiPhone /> Phone</label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="input"
                />
              </div>
              <div className="input-group">
                <label><FiMail /> Email</label>
                <input
                  type="email"
                  value={user?.email}
                  className="input"
                  disabled
                />
              </div>
              <div className="input-group">
                <label><FiGlobe /> Country</label>
                <input
                  type="text"
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  className="input"
                  placeholder="e.g., India"
                />
              </div>
            </div>
            {!isExpert && (
              <div className="input-group full-width">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  className="input"
                  rows="3"
                  placeholder="Tell us about yourself..."
                />
              </div>
            )}
          </div>

          {/* Expert-specific fields */}
          {isExpert && (
            <>
              <div className="form-section">
                <h2>Professional Details</h2>
                <div className="form-grid">
                  <div className="input-group">
                    <label>Professional Title</label>
                    <input
                      type="text"
                      name="title"
                      value={expertData.title}
                      onChange={handleExpertChange}
                      className="input"
                      placeholder="e.g., Career Coach"
                    />
                  </div>
                  <div className="input-group">
                    <label>Rate (₹/min)</label>
                    <input
                      type="number"
                      name="tokensPerMinute"
                      value={expertData.tokensPerMinute}
                      onChange={handleExpertChange}
                      className="input"
                      min="1"
                    />
                  </div>
                  <div className="input-group">
                    <label>Experience (years)</label>
                    <input
                      type="number"
                      name="experience"
                      value={expertData.experience}
                      onChange={handleExpertChange}
                      className="input"
                      min="0"
                    />
                  </div>
                </div>
                <div className="input-group full-width">
                  <label>Bio</label>
                  <textarea
                    name="bio"
                    value={expertData.bio}
                    onChange={handleExpertChange}
                    className="input"
                    rows="4"
                    placeholder="Tell clients about your expertise..."
                  />
                </div>
              </div>

              <div className="form-section">
                <h2>Categories</h2>
                <div className="checkbox-grid">
                  {categories.map(cat => (
                    <label key={cat._id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={expertData.categories.includes(cat._id)}
                        onChange={() => handleCategoryChange(cat._id)}
                      />
                      <span>{cat.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h2>Skills</h2>
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                    className="input"
                    placeholder="Add a skill and press Enter"
                  />
                  <button type="button" onClick={addSkill} className="btn btn-outline">Add</button>
                </div>
                <div className="tags-list">
                  {expertData.skills.map((skill, index) => (
                    <span key={index} className="tag">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h2>Languages</h2>
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    value={newLanguage}
                    onChange={(e) => setNewLanguage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addLanguage())}
                    className="input"
                    placeholder="Add a language and press Enter"
                  />
                  <button type="button" onClick={addLanguage} className="btn btn-outline">Add</button>
                </div>
                <div className="tags-list">
                  {expertData.languages.map((lang, index) => (
                    <span key={index} className="tag">
                      {lang}
                      <button type="button" onClick={() => removeLanguage(lang)}>&times;</button>
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => navigate(-1)} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              <FiSave /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
};

export default EditProfile;
