import { Route, Routes, useLocation } from 'react-router-dom';
import './App.css';
import ActiveCallModal from './components/ActiveCallModal';
import CallPopupModal from './components/CallPopupModal';
import Navbar from './components/Navbar';
import PrivateRoute from './components/PrivateRoute';
import About from './pages/About';
import AdminDashboard from './pages/AdminDashboard';
import BuyTokens from './pages/BuyTokens';
import CallHistory from './pages/CallHistory';
import Chat from './pages/Chat';
import EditProfile from './pages/EditProfile';
import ExpertDashboard from './pages/ExpertDashboard';
import ExpertEarnings from './pages/ExpertEarnings';
import ExpertProfile from './pages/ExpertProfile';
import Home from './pages/Home';
import Login from './pages/Login';
import OAuthCallback from './pages/OAuthCallback';
import Register from './pages/Register';
import RegisterExpert from './pages/RegisterExpert';
import TransactionHistory from './pages/TransactionHistory';
import UserDashboard from './pages/UserDashboard';

// Routes that should hide the main Navbar (they have their own sidebar)
const hiddenNavbarRoutes = ['/dashboard', '/expert-dashboard', '/admin', '/call-history', '/buy-tokens', '/add-money', '/edit-profile', '/expert-earnings', '/transactions', '/chat'];

function App() {
  const location = useLocation();
  const showNavbar = !hiddenNavbarRoutes.some(route => location.pathname.startsWith(route));
  // const { isExpert } = useAuth();
  // const { activeCall } = useSocket();

  return (
    <div className="app">
      {showNavbar && <Navbar />}
      {/* Global Call Popup Modal */}
      <CallPopupModal />
      {/* Global Active Call (WebRTC) Modal */}
      <ActiveCallModal />
      <main className={`main-content ${!showNavbar ? 'no-navbar' : ''}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register-expert" element={<RegisterExpert />} />
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/expert/:usernameOrId" element={<ExpertProfile />} />
          <Route 
            path="/dashboard" 
            element={
              <PrivateRoute>
                <UserDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/expert-dashboard" 
            element={
              <PrivateRoute expertOnly>
                <ExpertDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/edit-profile" 
            element={
              <PrivateRoute>
                <EditProfile />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/buy-tokens" 
            element={
              <PrivateRoute>
                <BuyTokens />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/call-history" 
            element={
              <PrivateRoute>
                <CallHistory />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/transactions" 
            element={
              <PrivateRoute>
                <TransactionHistory />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/chat" 
            element={
              <PrivateRoute>
                <Chat />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/admin/*" 
            element={
              <PrivateRoute adminOnly>
                <AdminDashboard />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/add-money" 
            element={
              <PrivateRoute>
                <BuyTokens />
              </PrivateRoute>
            } 
          />
          <Route 
            path="/expert-earnings" 
            element={
              <PrivateRoute expertOnly>
                <ExpertEarnings />
              </PrivateRoute>
            } 
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
