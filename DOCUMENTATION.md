# 📞 ConsultOnCall - Complete Documentation

> **A professional MERN stack real-time expert consultation marketplace where users connect with verified experts and pay per minute for instant guidance.**

---

## 📖 Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [Technology Stack](#technology-stack)
4. [Installation & Setup](#installation--setup)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication System](#authentication-system)
8. [Expert System](#expert-system)
9. [Call System](#call-system)
10. [Wallet & Billing](#wallet--billing)
11. [Admin Panel](#admin-panel)
12. [Deployment Guide](#deployment-guide)
13. [Testing Guide](#testing-guide)
14. [Troubleshooting](#troubleshooting)

---

## 🎯 Project Overview

### What is ConsultOnCall?

ConsultOnCall is a **real-time expert consultation marketplace** designed to connect users with verified experts across various domains. The platform enables:

- **Users** to get instant expert guidance by calling professionals
- **Experts** to earn money by providing consultations
- **Real-time billing** with per-minute charges
- **Admin controls** for platform management

### Why ConsultOnCall?

This is a **production-grade platform**, not a demo project. It's built to:
- Handle real-time video/audio calls
- Process payments securely with wallet system
- Manage expert approvals and verifications
- Provide detailed analytics and earnings tracking
- Scale for thousands of concurrent users

---

## ✨ Core Features

### 👤 **For Users**
- ✅ **Easy Registration** - Quick sign-up with email or Google OAuth
- ✅ **₹10 Welcome Credit** - Automatic wallet credit on first signup
- ✅ **Browse Experts** - Search and filter by category, rating, price
- ✅ **Real-time Calls** - Instant video/audio calls with experts
- ✅ **Wallet System** - Add money (₹100 - ₹1,000,000)
- ✅ **Call History** - Track all past consultations
- ✅ **Transaction History** - Complete billing transparency
- ✅ **Responsive Dashboard** - Mobile-friendly interface

### 👨‍💼 **For Experts**
- ✅ **Expert Registration** - Detailed profile creation
- ✅ **Admin Approval Required** - Profile goes live only after admin approval
- ✅ **Set Your Rate** - Define price per minute (₹/minute)
- ✅ **Real-time Status** - Online/Offline/Busy indicators
- ✅ **Earnings Dashboard** - Track income and claim tokens
- ✅ **Call Management** - Accept/reject incoming calls
- ✅ **Profile Verification** - Get verified badge from admin
- ✅ **Automatic Billing** - System handles all payment calculations

### 👑 **For Admins**
- ✅ **Expert Approval System** - Approve/reject expert registrations
- ✅ **User Management** - Block/suspend/activate users
- ✅ **Expert Verification** - Verify/unverify expert profiles
- ✅ **Platform Analytics** - View earnings, calls, user stats
- ✅ **Category Management** - Create and manage service categories
- ✅ **Full Control** - Complete platform oversight

---

## 🛠️ Technology Stack

### Frontend
- **React 18** - Modern UI library
- **React Router v6** - Client-side routing
- **Axios** - HTTP client for API calls
- **Socket.IO Client** - Real-time communication
- **React Toastify** - User notifications
- **React Icons** - Icon library

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB ODM
- **Socket.IO** - WebSocket for real-time features
- **JWT** - JSON Web Tokens for authentication
- **bcryptjs** - Password hashing
- **Passport.js** - OAuth authentication

### Deployment
- **Vercel** - Serverless deployment (Frontend + Backend)
- **MongoDB Atlas** - Cloud database

---

## ⚙️ Installation & Setup

### Prerequisites
```bash
✅ Node.js 16+ and npm
✅ MongoDB (local or Atlas account)
✅ Git
```

### Step 1: Clone Repository
```bash
git clone https://github.com/abbashaider5/consultoncall-frontend.git
cd guidance-marketplace
```

### Step 2: Install Dependencies
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

### Step 3: Environment Configuration

**Create `backend/.env`:**
```env
MONGODB_URI=mongodb://localhost:27017/consultoncall
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

**Create `.env.local` in root:**
```env
REACT_APP_API_URL=http://localhost:5000
```

### Step 4: Seed Database
```bash
cd server
node seed.js
```

**This will create:**
- 1 Admin user
- 3 Regular users (each with ₹10 initial credit)
- 8 Approved expert profiles
- 8 Service categories

### Step 5: Run Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm start
```

### Step 6: Access Application
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

---

## 🗄️ Database Schema

### User Model
```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  phone: String,
  country: String,
  avatar: String,
  googleId: String,
  authProvider: ['local', 'google'],
  role: ['user', 'expert', 'admin'],
  tokens: Number (default: 10),  // ₹10 initial credit
  isOnline: Boolean,
  status: ['active', 'blocked', 'suspended'],
  statusReason: String,
  createdAt: Date
}
```

### Expert Model
```javascript
{
  user: ObjectId (ref: User),
  title: String,
  bio: String,
  categories: [ObjectId] (ref: Category),
  tokensPerMinute: Number,  // Price per minute
  experience: Number,  // Years of experience
  skills: [String],
  languages: [String],
  country: String,
  rating: Number (0-5),
  totalRatings: Number,
  totalCalls: Number,
  totalMinutes: Number,
  tokensEarned: Number,
  tokensClaimed: Number,
  unclaimedTokens: Number,
  isVerified: Boolean,
  isApproved: Boolean,  // ⭐ Admin approval required
  approvedBy: ObjectId (ref: User),
  approvedAt: Date,
  rejectionReason: String,
  isAvailable: Boolean,
  isOnline: Boolean,
  isBusy: Boolean,  // ⭐ Currently on call
  currentCallId: ObjectId (ref: Call),
  createdAt: Date
}
```

### Call Model
```javascript
{
  caller: ObjectId (ref: User),
  expert: ObjectId (ref: Expert),
  status: ['initiated', 'ringing', 'ongoing', 'completed', 'missed', 'rejected', 'failed'],
  startTime: Date,
  endTime: Date,
  duration: Number (seconds),
  tokensPerMinute: Number,
  tokensSpent: Number,
  rating: Number (1-5),
  review: String,
  createdAt: Date
}
```

### Transaction Model
```javascript
{
  user: ObjectId (ref: User),
  type: ['credit', 'debit', 'refund', 'claim'],
  tokens: Number,
  description: String,
  call: ObjectId (ref: Call),
  status: ['pending', 'completed', 'failed'],
  tokensBefore: Number,
  tokensAfter: Number,
  createdAt: Date
}
```

### Category Model
```javascript
{
  name: String,
  slug: String (unique),
  description: String,
  icon: String,
  order: Number,
  createdAt: Date
}
```

---

## 🔐 Authentication System

### Google OAuth Configuration

**Credentials:**
- **Client ID:** `YOUR_GOOGLE_CLIENT_ID`
- **Client Secret:** `YOUR_GOOGLE_CLIENT_SECRET`
- **Redirect URI:** `http://localhost:3000/api/auth/google/callback`

### Authentication Flow

1. **Local Registration:**
   - User provides: name, email, password, phone
   - Password is hashed with bcryptjs
   - User receives ₹10 initial credit
   - JWT token issued

2. **Google OAuth:**
   - User clicks "Continue with Google"
   - Redirected to Google login
   - On success, user data saved/linked
   - JWT token issued
   - ₹10 credited for new users

3. **Expert Registration:**
   - All expert fields required
   - Profile created with `isApproved: false`
   - Expert cannot be visible until admin approval
   - Upon approval, expert can go live

### Protected Routes
- All user dashboards require authentication
- Expert routes require `role: 'expert'`
- Admin routes require `role: 'admin'`

---

## 👨‍💼 Expert System

### Expert Registration Process

**Step 1: Expert Sign-up**
```
User fills:
- Name, Email, Password
- Phone, Country
- Area of Expertise (Category)
- Years of Experience
- Price per Minute (₹/min)
- Skills & Languages
- Bio/Description
```

**Step 2: Profile Submission**
- Expert profile created with `isApproved: false`
- Expert can log in but profile is NOT visible on platform
- Expert sees "Awaiting Admin Approval" message

**Step 3: Admin Review**
- Admin views pending expert profiles
- Admin can:
  - **Approve** → Expert profile goes live
  - **Reject** → Expert notified with reason

**Step 4: Go Live**
- Approved experts can toggle online/offline
- Profile appears in expert listings
- Can start receiving calls

### Expert Status System

**Three-tier Status:**

1. **🟢 Online & Available**
   - Expert is logged in
   - Ready to accept calls
   - Shows as "Available" to users

2. **🔴 Busy**
   - Expert is currently on a call
   - Shows "Talking to someone" message
   - No new calls can be initiated
   - Automatically set when call starts
   - Auto-released when call ends

3. **⚫ Offline**
   - Expert logged out or marked offline
   - Not visible in "Online" filter
   - Cannot receive calls

### Expert Verification

- **Verified Badge** (✓)
- Admins can verify/unverify experts
- Builds user trust
- Verified experts get priority in search

---

## 📞 Call System

### Real-time Call Flow

**Step 1: Initiate Call**
```
User Checks:
✅ Expert is approved
✅ Expert is online
✅ Expert is NOT busy
✅ User has minimum ₹1 balance

System Creates:
- Call record with status: 'initiated'
- Stores expert's price per minute
```

**Step 2: Ringing**
```
- Socket emits to expert
- Expert receives incoming call notification
- Expert can Accept or Reject
```

**Step 3: Call Accepted**
```
- Call status: 'ongoing'
- Start time recorded
- Expert marked as isBusy: true
- Real-time connection established
```

**Step 4: During Call**
```
- Timer starts
- Wallet balance monitored real-time
- If balance < ₹1/min → Auto-disconnect
- Frontend polls /api/calls/check-balance/:callId
```

**Step 5: Call Ends**
```
Calculate:
- Duration (seconds)
- Minutes = ceil(duration / 60)
- Total Cost = minutes × tokensPerMinute

Billing:
- Deduct from user's wallet
- Add to expert's unclaimed tokens (90% share)
- Create transaction records
- Expert marked as isBusy: false
```

### Call Billing Example

**Expert Rate:** ₹25/minute  
**Call Duration:** 3 minutes 45 seconds

```
Rounded Minutes: 4 minutes
User Charged: 4 × ₹25 = ₹100
Platform Fee (10%): ₹10
Expert Earns: ₹90
```

### Real-time Balance Monitoring

Frontend calls every 30 seconds:
```javascript
GET /api/calls/check-balance/:callId

Response:
{
  currentBalance: 150,
  elapsedMinutes: 3,
  estimatedCost: 75,
  tokensPerMinute: 25,
  shouldEndCall: false
}
```

If `shouldEndCall: true` → Auto-disconnect

---

## 💰 Wallet & Billing System

### User Wallet Rules

**Initial Credit:**
- New users get ₹10 automatically on signup
- Applies to both email and Google signups

**Add Money:**
- **Minimum:** ₹100
- **Maximum:** ₹1,000,000
- Payment integration ready (Stripe/Razorpay)

**Wallet Visibility:**
- Always shown in header after login
- Updated in real-time during calls
- Visible in user dashboard

### Billing Flow

**During Call:**
1. Timer starts when call accepted
2. Every minute, system calculates cost
3. User's wallet monitored continuously
4. If insufficient balance → Call ends automatically

**After Call:**
```
Transaction Created for User:
{
  type: 'debit',
  tokens: 100,
  description: 'Call with Sarah Johnson (4 min)',
  tokensBefore: 250,
  tokensAfter: 150
}

Transaction for Expert:
{
  type: 'credit',
  tokens: 90,
  description: 'Earnings from call with John',
  tokensEarned: 90
}
```

### Expert Earnings

**Earning Split:**
- **Expert:** 90% of call charges
- **Platform:** 10% commission

**Claiming Earnings:**
```
Expert Dashboard shows:
- Total Earned: ₹10,000
- Claimed: ₹8,500
- Unclaimed: ₹1,500

Expert clicks "Claim Tokens"
→ Unclaimed tokens transferred to user wallet
→ Can be withdrawn or used for calls
```

### Transaction History

Users and Experts can view:
- Date & Time
- Transaction Type (Credit/Debit)
- Amount
- Description
- Running Balance

---

## 👑 Admin Panel

### Admin Powers

**User Management:**
```
Actions:
✅ View all users
✅ Block user (cannot login)
✅ Suspend user (temporary)
✅ Unblock/Unsuspend
✅ View wallet balance
✅ View transaction history
```

**Expert Management:**
```
Actions:
✅ View pending experts
✅ Approve expert profiles
✅ Reject with reason
✅ Verify/Unverify experts
✅ View earnings
✅ Block expert accounts
```

**Platform Analytics:**
```
Dashboard shows:
📊 Total Users
📊 Total Experts
📊 Active Calls
📊 Total Revenue
📊 Platform Earnings
📊 User Spending
📊 Expert Earnings
📊 Call Statistics
```

### Admin API Endpoints

**Experts:**
- `GET /api/experts/admin/all` - All experts
- `GET /api/experts/admin/pending` - Pending approvals
- `PUT /api/experts/admin/:id/approve` - Approve expert
- `PUT /api/experts/admin/:id/reject` - Reject expert
- `PUT /api/experts/admin/:id/verify` - Toggle verification
- `DELETE /api/experts/admin/:id` - Delete expert

**Users:**
- `GET /api/users/admin/all` - All users
- `GET /api/users/admin/statistics` - Platform stats
- `PUT /api/users/admin/:id/status` - Update user status

### Approval Workflow

**Pending Experts Table:**
```
Name | Email | Category | Experience | Rate | Actions
-----|-------|----------|------------|------|--------
John | john@  | Career  | 10 years   | ₹25  | ✅ ❌
```

**Approve:**
- Expert profile goes live immediately
- Expert can toggle online status
- Appears in expert listings

**Reject:**
- Expert notified
- Rejection reason stored
- Expert can resubmit profile

---

## 🚀 Deployment Guide

### Production Deployment (Vercel)

**Step 1: MongoDB Atlas Setup**
1. Create free cluster at mongodb.com/cloud/atlas
2. Create database user
3. Whitelist all IPs: `0.0.0.0/0`
4. Get connection string

**Step 2: Seed Production Database**
```bash
# Update MONGODB_URI in server/.env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/consultoncall

# Seed database
cd server
node seed.js
```

**Step 3: Push to GitHub**
```bash
git add .
git commit -m "Deploy ConsultOnCall to Vercel"
git push origin main
```

**Step 4: Deploy to Vercel**
1. Go to vercel.com
2. Import GitHub repository
3. Configure:
   - **Framework:** Other
   - **Build Command:** `npm install && npm run build`
   - **Output Directory:** `build`

**Step 5: Environment Variables**

Add in Vercel Settings → Environment Variables:
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production
CLIENT_URL=https://abbaslogic.com
  GOOGLE_CLIENT_ID=your-google-client-id-here
  GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_CALLBACK_URL=https://api.abbaslogic.com/api/auth/google/callback
```

**Step 6: Update Google OAuth**
1. Go to Google Cloud Console
2. Add Authorized Redirect URI:
   - `https://api.abbaslogic.com/api/auth/google/callback`

**Step 7: Deploy**
- Click "Deploy"
- Wait for build to complete
- Your app is live! 🎉

---

## 🧪 Testing Guide

### Default Login Credentials

**Admin Account:**
```
Email: admin@consultoncall.com
Password: admin@123
Role: Full platform control
```

**Sample User:**
```
Email: john@example.com
Password: password123
Wallet: ₹10 (initial credit)
```

**Sample Expert:**
```
Email: sarah@example.com
Password: password123
Status: Approved ✓
Rate: ₹25/minute
```

### Testing Checklist

**Authentication:**
- [ ] Register new user (check ₹10 credit)
- [ ] Login with email/password
- [ ] Login with Google OAuth
- [ ] Logout
- [ ] Expert registration
- [ ] Admin login

**User Features:**
- [ ] Browse experts
- [ ] Filter by category
- [ ] Search experts
- [ ] View expert profiles
- [ ] Check online/busy/offline status
- [ ] Initiate call (check balance validation)
- [ ] View call history
- [ ] View transaction history
- [ ] Add money to wallet

**Expert Features:**
- [ ] Expert dashboard access
- [ ] Toggle online/offline
- [ ] View earnings
- [ ] Claim tokens
- [ ] View call history
- [ ] Edit profile
- [ ] Check approval status

**Admin Features:**
- [ ] View pending experts
- [ ] Approve expert
- [ ] Reject expert with reason
- [ ] Verify/unverify expert
- [ ] View all users
- [ ] Block/unblock user
- [ ] View platform statistics
- [ ] Manage categories

**Call System:**
- [ ] Initiate call to online expert
- [ ] Expert receives notification
- [ ] Accept call (expert marked busy)
- [ ] Call timer starts
- [ ] Real-time balance deduction
- [ ] End call (billing calculated)
- [ ] Expert marked available
- [ ] Transaction created
- [ ] Call appears in history

**Responsive Design:**
- [ ] Test on mobile (< 576px)
- [ ] Test on tablet (576px - 968px)
- [ ] Test on desktop (> 968px)
- [ ] No horizontal scroll
- [ ] All buttons clickable on touch

---

## 🐛 Troubleshooting

### Common Issues

**Issue: Cannot connect to MongoDB**
```
Error: MongoNetworkError
Solution:
✅ Check MONGODB_URI is correct
✅ Verify MongoDB is running (local)
✅ Check IP whitelist (Atlas)
✅ Ensure network connection
```

**Issue: JWT token invalid**
```
Error: JsonWebTokenError
Solution:
✅ Verify JWT_SECRET is set
✅ Check token in localStorage
✅ Clear browser cache
✅ Re-login
```

**Issue: Google OAuth fails**
```
Error: redirect_uri_mismatch
Solution:
✅ Check Google Console redirect URI
✅ Must match exactly (no trailing slash)
✅ Update GOOGLE_CALLBACK_URL
✅ Restart server
```

**Issue: Expert profile not showing**
```
Problem: Profile created but not visible
Solution:
✅ Check isApproved status
✅ Expert must be approved by admin
✅ Admin logs in and approves
✅ Profile appears immediately
```

**Issue: Call not connecting**
```
Problem: Call initiation fails
Solution:
✅ Expert must be approved
✅ Expert must be online
✅ Expert must NOT be busy
✅ User must have ≥ ₹1 balance
```

**Issue: Wallet not updating**
```
Problem: Balance doesn't change after call
Solution:
✅ Check transaction logs
✅ Verify call.tokensSpent calculated
✅ Check user.tokens in database
✅ Ensure transaction created
```

**Issue: Build fails on Vercel**
```
Error: Build step failed
Solution:
✅ Check package.json dependencies
✅ Verify Node.js version compatibility
✅ Check environment variables
✅ Review Vercel build logs
```

### Debug Mode

**Enable detailed logging:**
```javascript
// In server/index.js
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}
```

**Check database records:**
```bash
mongosh
use consultoncall
db.users.find({ email: 'test@example.com' })
db.experts.find({ isApproved: false })
db.calls.find({ status: 'ongoing' })
```

---

## 📞 Support & Contact

**For Technical Issues:**
- Review this documentation
- Check troubleshooting section
- Verify environment variables
- Check MongoDB connection
- Review Vercel deployment logs

**For Feature Requests:**
- Open GitHub issue
- Contact development team

---

## 🎯 Project Status

**Current Version:** 1.0.0  
**Status:** Production Ready ✅  
**Last Updated:** December 2025

**Implemented Features:**
✅ User Registration & Authentication  
✅ Google OAuth Integration  
✅ Expert Registration with Approval System  
✅ Real-time Call System  
✅ Wallet & Billing System  
✅ Admin Panel with Full Controls  
✅ Transaction History  
✅ Expert Status (Online/Busy/Offline)  
✅ Responsive Design  
✅ Vercel Deployment Configuration  
✅ MongoDB Integration  
✅ ₹10 Initial Credit System  

---

## 📝 License

This project is proprietary and confidential.

---

**Built with ❤️ using MERN Stack**

**ConsultOnCall** - Connecting People with Expert Guidance

---

*For any questions or support, refer to the relevant sections above or check the troubleshooting guide.*
