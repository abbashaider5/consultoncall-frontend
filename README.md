# ConsultOnCall - Frontend

Production-ready React frontend for ConsultOnCall expert consultation platform.

## 🚀 Tech Stack

- **Framework**: React 18
- **Build Tool**: Create React App
- **Routing**: React Router v6
- **State Management**: Context API
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios
- **UI Icons**: React Icons
- **Notifications**: React Toastify
- **Deployment**: Vercel

## 📋 Features

### User Features
- ✅ User registration & login
- ✅ Google OAuth login
- ✅ LinkedIn OAuth login
- ✅ Profile management with avatar upload
- ✅ Wallet management (₹10 signup bonus)
- ✅ Browse experts by category
- ✅ Filter experts by rate, rating, availability
- ✅ Real-time call with experts
- ✅ Per-minute billing during calls
- ✅ Transaction history
- ✅ Call history

### Expert Features
- ✅ Expert profile creation
- ✅ Set per-minute consultation rate
- ✅ Add skills, experience, bio
- ✅ Real-time availability toggle
- ✅ Receive incoming call requests
- ✅ Earnings dashboard
- ✅ Claim earned tokens
- ✅ Call history and statistics

### Admin Features
- ✅ Comprehensive dashboard
- ✅ User management (block/unblock/delete)
- ✅ Expert approval workflow
- ✅ Expert verification badges
- ✅ Platform statistics
- ✅ Revenue tracking

### UI/UX
- ✅ Responsive design (mobile + desktop)
- ✅ Clean, modern interface
- ✅ Real-time status indicators
- ✅ Loading states
- ✅ Error handling
- ✅ Toast notifications

## 🔧 Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Setup

1. **Clone repository**
```bash
git clone https://github.com/abbashaider5/consultoncall-frontend.git
cd consultoncall-frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env.local
```

4. **Configure environment variables**
```env
REACT_APP_API_URL=http://localhost:5000
```

5. **Run development server**
```bash
npm start
```

App runs at: http://localhost:3000

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── CallModal.js
│   ├── CategoryCard.js
│   ├── DashboardLayout.js
│   ├── ExpertCard.js
│   ├── Footer.js
│   ├── IncomingCallModal.js
│   ├── Navbar.js
│   └── PrivateRoute.js
├── config/
│   └── api.js          # API configuration
├── context/
│   ├── AuthContext.js  # Authentication state
│   └── SocketContext.js # Socket.IO client
├── pages/              # Page components
│   ├── AddBalance.js
│   ├── AdminDashboard.js
│   ├── Auth.css
│   ├── BuyTokens.js
│   ├── CallHistory.js
│   ├── Dashboard.css
│   ├── EditProfile.js
│   ├── ExpertDashboard.js
│   ├── ExpertEarnings.js
│   ├── ExpertProfile.js
│   ├── Home.js
│   ├── Login.js
│   ├── OAuthCallback.js
│   ├── Register.js
│   ├── RegisterExpert.js
│   └── UserDashboard.js
├── App.js              # Main app component
├── index.js            # Entry point
└── index.css           # Global styles
```

## 🎨 Key Components

### AuthContext
- Manages authentication state
- JWT token handling
- User profile management
- Login/logout functionality
- OAuth callback handling

### SocketContext
- Socket.IO client connection
- Real-time expert status updates
- Call state management
- WebRTC signaling

### CallModal
- Initiates calls to experts
- Real-time call interface
- Duration tracking
- Balance monitoring

### IncomingCallModal
- Receive incoming calls (experts)
- Accept/reject interface
- Caller information display

### ExpertCard
- Display expert profile
- Online/busy status indicators
- Quick call action

### PrivateRoute
- Protected route wrapper
- Role-based access control
- Auto-redirect to login

## 🔄 State Management

### Auth State
```javascript
{
  user: { id, name, email, role, tokens, avatar },
  expert: { /* expert profile if applicable */ },
  isAuthenticated: boolean,
  isExpert: boolean,
  isAdmin: boolean
}
```

### Socket State
```javascript
{
  socket: Socket,
  onlineExperts: Set<expertId>,
  incomingCall: { callId, callerId, ... },
  activeCall: { callId, expertId, ... }
}
```

## 🌐 API Integration

### Base URL Configuration
```javascript
// src/config/api.js
const API_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://api.abbaslogic.com' 
    : 'http://localhost:5000'
  );
```

### Axios Configuration
All API calls automatically use the configured base URL:
```javascript
import axios from 'axios';
axios.defaults.baseURL = API_URL;
```

## 🔒 Security

- JWT tokens stored in localStorage
- Authorization header on all protected requests
- HTTPS in production
- No API keys or secrets in frontend code
- OAuth flows through backend
- Input validation and sanitization

## 🎯 Routes

### Public Routes
- `/` - Home page
- `/login` - Login page
- `/register` - User registration
- `/register-expert` - Expert registration
- `/oauth/callback` - OAuth callback handler

### Protected Routes (User)
- `/dashboard` - User dashboard
- `/expert/:id` - Expert profile
- `/add-money` - Add wallet balance
- `/buy-tokens` - Buy tokens
- `/call-history` - Call history
- `/edit-profile` - Edit user profile

### Protected Routes (Expert)
- `/expert-dashboard` - Expert dashboard
- `/expert-earnings` - Earnings page

### Protected Routes (Admin)
- `/admin-dashboard` - Admin dashboard

## 🚀 Production Deployment

### Vercel Setup

1. **Import GitHub repository**
2. **Framework**: Create React App
3. **Build Command**: `npm run build`
4. **Output Directory**: `build`
5. **Install Command**: `npm install`

### Environment Variables

Add in Vercel Dashboard:
```env
REACT_APP_API_URL=https://api.abbaslogic.com
```

### Build Production
```bash
npm run build
```

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm start

# Build for production
npm run build

# Run tests
npm test

# Eject (not recommended)
npm run eject
```

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints:
  - Mobile: < 768px
  - Tablet: 768px - 1024px
  - Desktop: > 1024px

## 🎨 Styling

- CSS Modules for component-specific styles
- Global styles in `index.css`
- CSS variables for theming
- Flexbox and Grid for layouts

## 🔔 Notifications

Uses React Toastify for user feedback:
- Success messages (green)
- Error messages (red)
- Info messages (blue)
- Warning messages (yellow)

## 🐛 Error Handling

- Network errors caught and displayed
- API errors show user-friendly messages
- Loading states for async operations
- Fallback UI for missing data

## 📊 Performance

- Code splitting with React.lazy
- Optimized images
- Memoization where needed
- Efficient re-renders

## 🧪 Testing

```bash
npm test
```

## 📝 License

MIT

## 👨‍💻 Developer

Abbas Haider
- GitHub: [@abbashaider5](https://github.com/abbashaider5)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📞 Support

For issues or questions, please open an issue on GitHub.
