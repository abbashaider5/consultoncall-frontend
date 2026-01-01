import { useState } from 'react';
import { BiRupee } from 'react-icons/bi';
import { FiHome, FiLogOut, FiMenu, FiPhone, FiPlusCircle, FiSettings, FiUser, FiX } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, isAuthenticated, isExpert, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  const handleNavClick = () => {
    setMenuOpen(false);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-brand">
          <img src={logo} alt="ConsultOnCall" className="brand-logo" />
        </Link>

        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <FiX /> : <FiMenu />}
        </button>

        <div className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
          <Link to="/" className="nav-link" onClick={handleNavClick}>
            <FiHome />
            <span>Home</span>
          </Link>
          <Link to="/about" className="nav-link" onClick={handleNavClick}>
            <span>About</span>
          </Link>

          {isAuthenticated ? (
            <>
              <div className="nav-balance">
                <BiRupee />
                <span>{user?.tokens || 0}</span>
              </div>

              {!isExpert && !isAdmin && (
                <Link to="/add-money" className="nav-link" onClick={handleNavClick}>
                  <FiPlusCircle />
                  <span>Add Money</span>
                </Link>
              )}

              <Link to="/call-history" className="nav-link" onClick={handleNavClick}>
                <FiPhone />
                <span>Sessions</span>
              </Link>

              {isAdmin && (
                <Link to="/admin" className="nav-link admin-link" onClick={handleNavClick}>
                  <FiSettings />
                  <span>Admin</span>
                </Link>
              )}

              <Link 
                to={isExpert ? '/expert-dashboard' : '/dashboard'} 
                className="nav-link"
                onClick={handleNavClick}
              >
                <FiUser />
                <span>Dashboard</span>
              </Link>

              <button onClick={handleLogout} className="nav-link logout-btn">
                <FiLogOut />
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link" onClick={handleNavClick}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm" onClick={handleNavClick}>
                Sign Up
              </Link>
              <Link to="/register-expert" className="btn btn-secondary btn-sm" onClick={handleNavClick}>
                Become Expert
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
