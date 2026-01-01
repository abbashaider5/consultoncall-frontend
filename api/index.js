const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('../server/config/passport');

const authRoutes = require('../server/routes/auth');
const userRoutes = require('../server/routes/users');
const expertRoutes = require('../server/routes/experts');
const categoryRoutes = require('../server/routes/categories');
const callRoutes = require('../server/routes/calls');

// Import models to ensure they are registered
const User = require('../server/models/User');
const Expert = require('../server/models/Expert');
const Category = require('../server/models/Category');
const Call = require('../server/models/Call');
const Transaction = require('../server/models/Transaction');

const app = express();

// Allowed origins for CORS
const allowedOrigins = [
  process.env.CLIENT_URL
].filter(Boolean);

// Middleware
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow production domain
    if (origin && (origin === 'https://abbaslogic.com' || origin === 'http://localhost:3000')) {
      return callback(null, true);
    }
    return callback(null, true); // Allow all for now
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json());
app.use(passport.initialize());

// MongoDB Connection with caching for serverless
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    cachedDb = db;
    console.log('MongoDB Connected');
    return db;
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
}

// Connect to database on cold start
connectToDatabase().catch(console.error);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/experts', expertRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/calls', callRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/api', (req, res) => {
  res.json({ message: 'ConsultOnCall API is running' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    message: 'Internal server error', 
    error: process.env.NODE_ENV === 'development' ? err.message : undefined 
  });
});

// Export the Express app for Vercel
module.exports = app;
