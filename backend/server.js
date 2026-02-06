const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const path = require('path'); // <-- required for serving frontend
const rateLimit = require('express-rate-limit');

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting - disabled for development
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   standardHeaders: true,
//   legacyHeaders: false,
//   trustProxy: false
// });
// app.use('/api/', limiter);

// MongoDB Connection
const connectDB = async () => {
  try {
    console.log('🔄 Connecting to MongoDB Atlas...');
    console.log('Connection string:', process.env.MONGODB_URI ? 'Configured' : 'Not configured');

    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cognixai', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 30000,
      retryWrites: true,
      w: 'majority'
    });

    console.log('✅ MongoDB Atlas connected successfully!');
    console.log(`📊 Database: ${conn.connection.name}`);
    console.log(`🌐 Host: ${conn.connection.host}`);
    console.log(`📡 Ready State: ${conn.connection.readyState}`);
    console.log(
      `🔗 Connection Type: ${process.env.MONGODB_URI?.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB'}`
    );
  } catch (error) {
    console.error('❌ MongoDB Atlas connection error:', error.message);
    console.log('⚠️  Server will continue running, but database operations will fail');
  }
};
connectDB();

// MongoDB connection events
mongoose.connection.on('connected', () => console.log('🟢 MongoDB connected'));
mongoose.connection.on('error', (err) => console.error('🔴 MongoDB connection error:', err));
mongoose.connection.on('disconnected', () => console.log('🟡 MongoDB disconnected'));
mongoose.connection.on('reconnected', () => console.log('🟢 MongoDB reconnected'));

// API Routes
app.use('/api/contact', require('./routes/contact'));
app.use('/api/testimonials', require('./routes/testimonials'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/blogs', require('./routes/blog'));
app.use('/api/newsletter', require('./routes/newsletter'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Server is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    database: mongoose.connection.name || 'not connected'
  });
});

// Database status check
app.get('/api/db-status', async (req, res) => {
  try {
    const Contact = require('./models/Contact');
    const contactCount = await Contact.countDocuments();

    res.json({
      status: 'Database connected',
      type: process.env.MONGODB_URI?.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB',
      database: mongoose.connection.name,
      host: mongoose.connection.host,
      readyState: mongoose.connection.readyState,
      contactsCount: contactCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ status: 'Database error', error: error.message, timestamp: new Date().toISOString() });
  }
});

// Test contact endpoint
app.post('/api/contact/test', (req, res) => {
  console.log('Test endpoint hit with body:', req.body);
  res.json({ message: 'Test endpoint working', receivedData: req.body, timestamp: new Date().toISOString() });
});

// Admin endpoint for recent contacts
app.get('/api/contacts', async (req, res) => {
  try {
    const Contact = require('./models/Contact');
    const contacts = await Contact.find().sort({ createdAt: -1 }).limit(10);

    res.json({
      success: true,
      count: contacts.length,
      data: contacts.map((contact) => ({
        id: contact._id,
        fullName: contact.fullName,
        email: contact.email,
        phone: contact.phone,
        companyName: contact.companyName,
        serviceInterested: contact.serviceInterested,
        message: contact.message.substring(0, 100) + (contact.message.length > 100 ? '...' : ''),
        createdAt: contact.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

////////////////////////////////////////////////////////////////////////////////////
// ✅ Serve React frontend (Fix for "Cannot GET /")
////////////////////////////////////////////////////////////////////////////////////
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Serve index.html for all unknown routes (React handles routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
});

////////////////////////////////////////////////////////////////////////////////////

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
