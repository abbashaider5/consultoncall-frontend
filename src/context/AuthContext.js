import { createContext, useContext, useEffect, useState } from 'react';
import { axiosInstance as axios } from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [expert, setExpert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Set axios default header
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const res = await axios.get('/api/auth/me');
          setUser(res.data.user);
          setExpert(res.data.expert);
        } catch (error) {
          console.error('Auth check failed:', error);
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
          setExpert(null);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, [token]);

  const login = async (email, password) => {
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setExpert(res.data.expert);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const res = await axios.post('/api/auth/register', userData);
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Registration failed' 
      };
    }
  };

  const registerExpert = async (expertData) => {
    try {
      const res = await axios.post('/api/auth/register-expert', expertData);
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      setExpert(res.data.expert);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.message || 'Registration failed' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setExpert(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  const handleOAuthCallback = async (oauthToken) => {
    try {
      localStorage.setItem('token', oauthToken);
      setToken(oauthToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${oauthToken}`;
      
      const res = await axios.get('/api/auth/me');
      setUser(res.data.user);
      setExpert(res.data.expert);
      return true;
    } catch (error) {
      console.error('OAuth callback error:', error);
      localStorage.removeItem('token');
      setToken(null);
      return false;
    }
  };

  const updateUser = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }));
  };

  const updateExpert = (updatedExpert) => {
    setExpert(prev => ({ ...prev, ...updatedExpert }));
  };

  const updateTokens = (newTokens) => {
    setUser(prev => ({ ...prev, tokens: newTokens }));
  };

  const value = {
    user,
    expert,
    token,
    loading,
    login,
    register,
    registerExpert,
    logout,
    updateTokens,
    updateUser,
    updateExpert,
    handleOAuthCallback,
    isAuthenticated: !!user,
    isExpert: user?.role === 'expert'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
