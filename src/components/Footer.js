import { FiGithub, FiHeart, FiLinkedin, FiMail, FiPhone, FiTwitter } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import logo from '../assets/logo.png';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Section */}
          <div className="footer-brand">
            <Link to="/" className="footer-logo">
              <img src={logo} alt="ConsultOnCall" className="footer-logo-img" />
            </Link>
            <p className="footer-description">
              Connect with verified experts for real-time professional consultation. 
              Get instant advice from approved experts.</p>
            <div className="social-links">
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                <FiTwitter />
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                <FiLinkedin />
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FiGithub />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="footer-links">
            <h4>Quick Links</h4>
            <ul>
              <li><Link to="/">Browse Experts</Link></li>
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/register-expert">Become an Expert</Link></li>
              <li><Link to="/login">Login</Link></li>
              <li><Link to="/register">Sign Up</Link></li>
            </ul>
          </div>

          {/* Categories */}
          <div className="footer-links">
            <h4>Categories</h4>
            <ul>
              <li><Link to="/">Expert Consultation</Link></li>
              <li><Link to="/">Business & Startup</Link></li>
              <li><Link to="/">Legal Advice</Link></li>
              <li><Link to="/">Mental Health</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-contact">
            <h4>Contact Us</h4>
            <ul>
              <li>
                <FiMail />
                <a href="mailto:support@consultoncall.com">support@consultoncall.com</a>
              </li>
              <li>
                <FiPhone />
                <a href="tel:+911234567890">+91 123 456 7890</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {currentYear} ConsultOnCall. All rights reserved.</p>
          <p className="made-with">
            Made with <FiHeart className="heart-icon" /> in India
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
