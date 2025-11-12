const express = require('express');
const User = require('../models/User');
const router = express.Router();

// Get all users (except current user)
router.get('/', async (req, res) => {
    try {
        const { exclude } = req.query;
        
        // Build filter to exclude current user
        const filter = exclude ? { _id: { $ne: exclude } } : {};
        
        const users = await User.find(filter)
            .select('username avatar online lastSeen status email phone')
            .sort({ username: 1 });
            
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Search users by username, email, or phone
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }
        
        const users = await User.find({
            $or: [
                { username: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { phone: { $regex: q, $options: 'i' } }
            ]
        }).select('username avatar online lastSeen status email phone');
        
        res.json(users);
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const user = await User.findById(userId)
            .select('username avatar online lastSeen status email phone');
            
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
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
        
        // Check if username is taken by another user
        if (username) {
            const existingUser = await User.findOne({ 
                username, 
                _id: { $ne: decoded.userId } 
            });
            if (existingUser) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }
        
        const user = await User.findByIdAndUpdate(
            decoded.userId,
            { username, status, avatar },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ 
            message: 'Profile updated successfully',
            user 
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;