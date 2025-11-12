

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Input validation middleware
const validateRegisterInput = (req, res, next) => {
    const { username, email, phone, password } = req.body;
    
    if (!username || !email || !phone || !password) {
        return res.status(400).json({
            error: 'All fields are required'
        });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            error: 'Please provide a valid email address'
        });
    }

    // Password strength validation
    if (password.length < 6) {
        return res.status(400).json({
            error: 'Password must be at least 6 characters long'
        });
    }

    // Phone validation (basic)
    if (phone.length < 10) {
        return res.status(400).json({
            error: 'Please provide a valid phone number'
        });
    }

    next();
};

const validateLoginInput = (req, res, next) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            error: 'Email and password are required'
        });
    }

    next();
};

// Register endpoint
router.post('/register', validateRegisterInput, async (req, res) => {
    try {
        console.log('✅ /api/auth/register route hit!', { 
            ...req.body, 
            password: '***' // Don't log actual password
        });
        
        const { username, email, phone, password } = req.body;

        console.log('🔍 Checking for existing user...');
        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }, { phone }]
        });

        if (existingUser) {
            console.log('❌ User already exists');
            let field = '';
            if (existingUser.email === email) field = 'email';
            else if (existingUser.username === username) field = 'username';
            else if (existingUser.phone === phone) field = 'phone';
            
            return res.status(400).json({
                error: `User with this ${field} already exists`
            });
        }

        console.log('👤 Creating new user...');
        // Create user
        const user = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            phone: phone.trim(),
            password
        });

        console.log('💾 Saving user to database...');
        await user.save();
        console.log('✅ User created:', user._id);

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        console.log('🎉 Registration successful!');
        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                online: user.online,
                status: user.status,
                lastSeen: user.lastSeen
            }
        });

    } catch (error) {
        console.error('❌ Registration error details:', error);
        
        // Mongoose validation errors
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                error: 'Validation failed',
                details: errors
            });
        }

        // Duplicate key error (should be caught above but as backup)
        if (error.code === 11000) {
            return res.status(400).json({
                error: 'User with this email, username or phone already exists'
            });
        }

        res.status(500).json({ 
            error: 'Server error during registration',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Login endpoint
router.post('/login', validateLoginInput, async (req, res) => {
    try {
        console.log('✅ /api/auth/login route hit!', { 
            ...req.body, 
            password: '***' 
        });
        
        const { email, password } = req.body;

        // Find user by email (case insensitive)
        const user = await User.findOne({ 
            email: email.toLowerCase().trim() 
        });

        if (!user) {
            console.log('❌ User not found for email:', email);
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        console.log('🔐 Checking password for user:', user._id);
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            console.log('❌ Password mismatch for user:', user._id);
            return res.status(401).json({ 
                error: 'Invalid email or password' 
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET || 'fallback-secret-key',
            { expiresIn: '7d' }
        );

        // Update user status
        user.online = true;
        user.lastSeen = new Date();
        await user.save();

        console.log('✅ Login successful for user:', user._id);
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                online: user.online,
                status: user.status,
                lastSeen: user.lastSeen
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({ 
            error: 'Server error during login',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.header('Authorization');
        if (!authHeader) {
            return res.status(401).json({ 
                error: 'No authorization header provided' 
            });
        }

        const token = authHeader.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'No token provided' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
        const user = await User.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ 
                error: 'User not found' 
            });
        }

        res.json({ 
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                online: user.online,
                status: user.status,
                lastSeen: user.lastSeen
            }
        });

    } catch (error) {
        console.error('❌ Auth error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired' 
            });
        }

        res.status(500).json({ 
            error: 'Authentication failed',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Logout endpoint (optional - for updating online status)
router.post('/logout', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
            await User.findByIdAndUpdate(decoded.userId, {
                online: false,
                lastSeen: new Date()
            });
        }

        res.json({ 
            message: 'Logged out successfully' 
        });

    } catch (error) {
        console.error('❌ Logout error:', error);
        // Even if there's an error, we should still respond successfully
        // since logout should generally work even if token is invalid
        res.json({ 
            message: 'Logged out successfully' 
        });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key');
        const { username, status, avatar } = req.body;

        const updateData = {};
        if (username) updateData.username = username.trim();
        if (status !== undefined) updateData.status = status;
        if (avatar) updateData.avatar = avatar;

        const user = await User.findByIdAndUpdate(
            decoded.userId,
            updateData,
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                phone: user.phone,
                avatar: user.avatar,
                online: user.online,
                status: user.status,
                lastSeen: user.lastSeen
            }
        });

    } catch (error) {
        console.error('❌ Profile update error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }

        if (error.code === 11000) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        res.status(500).json({ 
            error: 'Failed to update profile',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;