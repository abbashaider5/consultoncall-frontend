import { faArrowRight, faBolt, faCheck, faCircle, faSearch, faShieldAlt, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ExpertCard from '../components/ExpertCard';
import Footer from '../components/Footer';
import { axiosInstance } from '../config/api';
import { useSocket } from '../context/SocketContext';
import './Home.css';

const Home = () => {
  const [categories, setCategories] = useState([]);
  const [experts, setExperts] = useState([]);
  const [filteredExperts, setFilteredExperts] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const { onlineExperts, initializeExpertStatus } = useSocket();

  const [dataFetched, setDataFetched] = useState(false);

  const fetchData = useCallback(async () => {
    if (dataFetched) return; // Prevent duplicate calls
    
    try {
      setLoading(true);
      
      // Seed categories first (for initial setup) - ignore errors
      // await axiosInstance.post('/api/categories/seed').catch(() => {});
      
      const [categoriesRes, expertsRes] = await Promise.all([
        axiosInstance.get('/api/categories').catch(err => {
          console.error('Categories fetch error:', err);
          return { data: { success: false, data: [] } };
        }),
        axiosInstance.get('/api/experts').catch(err => {
          console.error('Experts fetch error:', err);
          return { data: { success: false, experts: [] } };
        })
      ]);
      
      // Handle standardized API response format with fallbacks
      const categoriesData = categoriesRes.data?.data || categoriesRes.data || [];
      const expertsData = expertsRes.data?.experts || expertsRes.data?.data || [];
      
      // Ensure we have valid arrays
      const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
      const safeExperts = Array.isArray(expertsData) ? expertsData : [];
      
      setCategories(safeCategories);
      setExperts(safeExperts);
      setFilteredExperts(safeExperts);
      
      // Initialize expert statuses in SocketContext for real-time updates
      // This ensures expert cards show correct status from API initially,
      // then socket events update status in real-time
      if (typeof initializeExpertStatus === 'function') {
        initializeExpertStatus(safeExperts);
      }
      
      setDataFetched(true);
    } catch (error) {
      console.error('Fetch data error:', error);
      // Set empty arrays to prevent crashes
      setCategories([]);
      setExperts([]);
      setFilteredExperts([]);
      setDataFetched(true);
    } finally {
      setLoading(false);
    }
  }, [dataFetched]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filterExperts = useCallback(() => {
    let filtered = [...experts];
    
    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(expert => 
        expert.categories?.some(cat => cat._id === selectedCategory)
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(expert =>
        expert.user?.name?.toLowerCase().includes(query) ||
        expert.title?.toLowerCase().includes(query) ||
        expert.skills?.some(skill => skill.toLowerCase().includes(query))
      );
    }
    
    // Filter by online status
    if (showOnlineOnly) {
      filtered = filtered.filter(expert => 
        expert.isOnline || onlineExperts.has(expert._id)
      );
    }
    
    // Sort: online experts first
    filtered.sort((a, b) => {
      const aOnline = a.isOnline || onlineExperts.has(a._id);
      const bOnline = b.isOnline || onlineExperts.has(b._id);
      if (aOnline && !bOnline) return -1;
      if (!aOnline && bOnline) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });
    
    setFilteredExperts(filtered);
      }, [experts, onlineExperts, searchQuery, selectedCategory, showOnlineOnly]);

      useEffect(() => {
        filterExperts();
      }, [filterExperts]);

  if (loading) {
    return (
      <div className="home">
        {/* Hero Section - Keep as is during loading */}
        <section className="hero">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <span className="hero-badge">
                  <FontAwesomeIcon icon={faBolt} /> Trusted by 10,000+ users
                </span>
                <h1>Get Expert Guidance, Anytime</h1>
                <p>Connect with verified professionals for personalized consultation via real-time calls. Get instant expert advice on career, business, legal, health & more.</p>
                
                <div className="hero-features">
                  <div className="feature-item">
                    <FontAwesomeIcon icon={faCheck} /> Verified Experts
                  </div>
                  <div className="feature-item">
                    <FontAwesomeIcon icon={faCheck} /> Pay Per Minute
                  </div>
                  <div className="feature-item">
                    <FontAwesomeIcon icon={faCheck} /> Instant Connect
                  </div>
                </div>

                <div className="hero-actions">
                  <Link to="/register" className="btn btn-primary btn-lg">
                    Get Started <FontAwesomeIcon icon={faArrowRight} />
                  </Link>
                  <Link to="/register-expert" className="btn btn-outline btn-lg">
                    Become an Expert
                  </Link>
                </div>
              </div>
              
              <div className="hero-image">
                <div className="hero-image-wrapper">
                  <img 
                    src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=700&fit=crop&auto=format"
                    alt="Expert professional"
                  />
                  <div className="floating-card card-1">
                    <FontAwesomeIcon icon={faUsers} className="card-icon" />
                    <div className="card-info">
                      <span className="card-value">500+</span>
                      <span className="card-label">Experts Online</span>
                    </div>
                  </div>
                  <div className="floating-card card-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="card-icon" />
                    <div className="card-info">
                      <span className="card-value">Verified</span>
                      <span className="card-label">& Trusted</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Search Section - Keep as is */}
        <section className="search-section">
          <div className="container">
            <div className="search-bar">
              <FontAwesomeIcon icon={faSearch} className="search-icon" />
              <input
                type="text"
                placeholder="Search experts by name, skill, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </section>

        {/* Filters Section - Skeleton */}
        <section className="filters-section">
          <div className="container">
            <div className="filters-wrapper">
              <div className="filter-group">
                <div className="skeleton skeleton-text" style={{width: '60px', height: '16px', marginBottom: '8px'}}></div>
                <div className="skeleton" style={{width: '150px', height: '40px', borderRadius: '6px'}}></div>
              </div>
              
              <div className="filter-group">
                <div className="skeleton skeleton-text" style={{width: '50px', height: '16px', marginBottom: '8px'}}></div>
                <div className="filter-buttons">
                  <div className="skeleton" style={{width: '60px', height: '36px', borderRadius: '6px', marginRight: '8px'}}></div>
                  <div className="skeleton" style={{width: '100px', height: '36px', borderRadius: '6px'}}></div>
                </div>
              </div>
              
              <div className="filter-stats">
                <div className="skeleton skeleton-text" style={{width: '120px', height: '16px'}}></div>
                <div className="skeleton skeleton-text" style={{width: '100px', height: '16px'}}></div>
              </div>
            </div>
          </div>
        </section>

        {/* Experts Section - Skeleton */}
        <section className="all-experts-section">
          <div className="container">
            <div className="section-header">
              <div className="skeleton skeleton-text" style={{width: '200px', height: '32px', marginBottom: '8px'}}></div>
              <div className="skeleton skeleton-text" style={{width: '100px', height: '20px'}}></div>
            </div>
            
            <div className="experts-grid">
              {/* Generate 8 skeleton expert cards */}
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="expert-card skeleton">
                  <div className="expert-header">
                    <div className="expert-avatar skeleton" style={{width: '60px', height: '60px', borderRadius: '50%'}}></div>
                    <div className="expert-info">
                      <div className="skeleton skeleton-text" style={{width: '120px', height: '20px', marginBottom: '4px'}}></div>
                      <div className="skeleton skeleton-text" style={{width: '80px', height: '16px'}}></div>
                    </div>
                  </div>
                  <div className="expert-details">
                    <div className="skeleton skeleton-text" style={{width: '100%', height: '16px', marginBottom: '8px'}}></div>
                    <div className="skeleton skeleton-text" style={{width: '80%', height: '16px', marginBottom: '12px'}}></div>
                    <div className="expert-skills">
                      <div className="skeleton" style={{width: '60px', height: '24px', borderRadius: '12px', marginRight: '8px'}}></div>
                      <div className="skeleton" style={{width: '70px', height: '24px', borderRadius: '12px', marginRight: '8px'}}></div>
                      <div className="skeleton" style={{width: '50px', height: '24px', borderRadius: '12px'}}></div>
                    </div>
                  </div>
                  <div className="expert-footer">
                    <div className="skeleton" style={{width: '80px', height: '32px', borderRadius: '6px'}}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <Footer />
      </div>
    );
  }

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-content">
              <span className="hero-badge">
                <FontAwesomeIcon icon={faBolt} /> Trusted by 10,000+ users
              </span>
              <h1>Get Expert Guidance, Anytime</h1>
              <p>Connect with verified professionals for personalized consultation via real-time calls. Get instant expert advice on career, business, legal, health & more.</p>
              
              <div className="hero-features">
                <div className="feature-item">
                  <FontAwesomeIcon icon={faCheck} /> Verified Experts
                </div>
                <div className="feature-item">
                  <FontAwesomeIcon icon={faCheck} /> Pay Per Minute
                </div>
                <div className="feature-item">
                  <FontAwesomeIcon icon={faCheck} /> Instant Connect
                </div>
              </div>

              <div className="hero-actions">
                <Link to="/register" className="btn btn-primary btn-lg">
                  Get Started <FontAwesomeIcon icon={faArrowRight} />
                </Link>
                <Link to="/register-expert" className="btn btn-outline btn-lg">
                  Become an Expert
                </Link>
              </div>
            </div>
            
            <div className="hero-image">
              <div className="hero-image-wrapper">
                <img 
                  src="https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=600&h=700&fit=crop&auto=format"
                  alt="Expert professional"
                />
                <div className="floating-card card-1">
                  <FontAwesomeIcon icon={faUsers} className="card-icon" />
                  <div className="card-info">
                    <span className="card-value">500+</span>
                    <span className="card-label">Experts Online</span>
                  </div>
                </div>
                <div className="floating-card card-2">
                  <FontAwesomeIcon icon={faShieldAlt} className="card-icon" />
                  <div className="card-info">
                    <span className="card-value">Verified</span>
                    <span className="card-label">& Trusted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Search Section */}
      <section className="search-section">
        <div className="container">
          <div className="search-bar">
            <FontAwesomeIcon icon={faSearch} className="search-icon" />
            <input
              type="text"
              placeholder="Search experts by name, skill, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      </section>

      {/* Filters Section */}
      <section className="filters-section">
        <div className="container">
          <div className="filters-wrapper">
            <div className="filter-group">
              <label className="filter-label">Category</label>
              <select 
                className="filter-select"
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="filter-group">
              <label className="filter-label">Status</label>
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${!showOnlineOnly ? 'active' : ''}`}
                  onClick={() => setShowOnlineOnly(false)}
                >
                  All
                </button>
                <button 
                  className={`filter-btn ${showOnlineOnly ? 'active' : ''}`}
                  onClick={() => setShowOnlineOnly(true)}
                >
                  <FontAwesomeIcon icon={faCircle} className="online-indicator" /> Online Only
                </button>
              </div>
            </div>
            
            <div className="filter-stats">
              <span className="stat-item">
                <strong>{filteredExperts.length}</strong> experts found
              </span>
              <span className="stat-item online">
                <strong>{experts.filter(e => e.isOnline || onlineExperts.has(e._id)).length}</strong> online now
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* All/Filtered Experts */}
      <section className="all-experts-section">
        <div className="container">
          <div className="section-header">
            <h2>
              {selectedCategory 
                ? `${categories.find(c => c._id === selectedCategory)?.name || ''} Experts`
                : searchQuery 
                  ? 'Search Results'
                  : 'All Experts'
              }
            </h2>
            <span className="expert-count">{filteredExperts.length} experts</span>
          </div>
          
          {filteredExperts.length === 0 ? (
            <div className="no-results">
              <p>No experts found. Try adjusting your filters.</p>
            </div>
          ) : (
            <div className="experts-grid">
              {filteredExperts.map(expert => (
                <ExpertCard key={expert._id} expert={expert} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default Home;
