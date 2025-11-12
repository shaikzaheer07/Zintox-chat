const express = require('express');
const Message = require('../models/Message');
const Chat = require('../models/Chat');
const router = express.Router();

// Get messages for a chat
router.get('/chat/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const messages = await Message.find({ chat: chatId })
            .populate('sender', 'username avatar')
            .populate('repliedTo')
            .sort({ timestamp: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        // Reverse to get chronological order
        const chronologicalMessages = messages.reverse();

        res.json({
            messages: chronologicalMessages,
            currentPage: page,
            totalPages: Math.ceil(await Message.countDocuments({ chat: chatId }) / limit)
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Mark messages as read
router.post('/mark-read', async (req, res) => {
    try {
        const { messageIds, userId } = req.body;

        await Message.updateMany(
            { _id: { $in: messageIds } },
            { $addToSet: { readBy: userId } }
        );

        res.json({ message: 'Messages marked as read' });
    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark messages as read' });
    }
});

// Add reaction to message
router.post('/:messageId/react', async (req, res) => {
    try {
        const { messageId } = req.params;
        const { userId, emoji } = req.body;

        const message = await Message.findById(messageId);
        
        // Remove existing reaction from this user
        message.reactions = message.reactions.filter(
            reaction => reaction.user.toString() !== userId
        );

        // Add new reaction
        message.reactions.push({ user: userId, emoji });
        
        await message.save();
        await message.populate('reactions.user', 'username avatar');

        res.json(message);
    } catch (error) {
        console.error('React error:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

module.exports = router;