import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faComment, faPhone, faShieldAlt, faUsers, faBolt } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import './About.css';

const About = () => {
  const features = [
    {
      icon: <FontAwesomeIcon icon={faPhone} />,
      title: 'Instant Expert Calls',
      description: 'Connect with verified experts in real-time via audio calls'
    },
    {
      icon: <FontAwesomeIcon icon={faComment} />,
      title: 'Free Chat',
      description: 'Message experts for free before initiating a paid call'
    },
    {
      icon: <FontAwesomeIcon icon={faShieldAlt} />,
      title: 'Secure Payments',
      description: 'Per-minute billing with transparent pricing and secure transactions'
    },
    {
      icon: <FontAwesomeIcon icon={faUsers} />,
      title: 'Verified Experts',
      description: 'All experts are LinkedIn-verified professionals in their fields'
    },
    {
      icon: <FontAwesomeIcon icon={faBolt} />,
      title: 'Real-Time Analytics',
      description: 'Track your earnings, calls, and sessions with live analytics'
    },
    {
      icon: <FontAwesomeIcon icon={faCheckCircle} />,
      title: 'Quality Assured',
      description: 'Professional platform with robust call quality and reliability'
    }
  ];

  return (
    <div className="about-page">
      <Navbar />
      <div className="about-content">
        <section className="hero-section">
          <h1 className="hero-title">About ConsultOnCall</h1>
          <p className="hero-subtitle">
            Connecting Knowledge Seekers with Industry Experts
          </p>
        </section>

        <section className="mission-section">
          <div className="mission-card">
            <h2>Our Mission</h2>
            <p>
              To democratize access to expert knowledge by creating a seamless platform where anyone can instantly connect with verified professionals for personalized guidance and consultations.
            </p>
          </div>
          <div className="mission-card">
            <h2>Our Vision</h2>
            <p>
              To become the world's most trusted on-demand expert consultation platform, empowering professionals to monetize their expertise while helping individuals make informed decisions.
            </p>
          </div>
        </section>

        <section className="features-section">
          <h2 className="section-title">Platform Features</h2>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card">
                <div className="feature-icon">{feature.icon}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-desc">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="how-it-works-section">
          <h2 className="section-title">How It Works</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Browse Experts</h3>
              <p>Explore our diverse pool of verified professionals across multiple domains</p>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Free Chat</h3>
              <p>Message experts for free to discuss your needs and confirm availability</p>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Connect Instantly</h3>
              <p>Initiate a real-time audio call and get expert guidance on demand</p>
            </div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Pay Per Minute</h3>
              <p>Only pay for the time you use with transparent per-minute billing</p>
            </div>
          </div>
        </section>

        <section className="cta-section">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of users and experts on our platform today</p>
          <div className="cta-buttons">
            <Link to="/register" className="cta-btn primary">Sign Up as User</Link>
            <Link to="/register-expert" className="cta-btn secondary">Become an Expert</Link>
          </div>
        </section>
      </div>
      <Footer />
    </div>
  );
};

export default About;
