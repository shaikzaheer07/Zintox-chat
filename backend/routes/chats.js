const express = require('express');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// Get all chats for a user
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const chats = await Chat.find({
            participants: userId
        })
        .populate('participants', 'username avatar online lastSeen status')
        .populate('lastMessage')
        .populate('groupAdmin', 'username avatar')
        .sort({ updatedAt: -1 });

        res.json(chats);
    } catch (error) {
        console.error('Get chats error:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// Create a new chat (1-on-1 or group)
router.post('/', async (req, res) => {
    try {
        const { participants, isGroup, groupName, groupDescription } = req.body;

        // For 1-on-1 chat, check if chat already exists
        if (!isGroup && participants.length === 2) {
            const existingChat = await Chat.findOne({
                participants: { $all: participants },
                isGroup: false
            });

            if (existingChat) {
                return res.json(existingChat);
            }
        }

        const chat = new Chat({
            participants,
            isGroup,
            groupName,
            groupDescription,
            groupAdmin: isGroup ? participants[0] : null
        });

        await chat.save();
        await chat.populate('participants', 'username avatar online lastSeen status');
        
        if (isGroup) {
            await chat.populate('groupAdmin', 'username avatar');
        }

        res.status(201).json(chat);
    } catch (error) {
        console.error('Create chat error:', error);
        res.status(500).json({ error: 'Failed to create chat' });
    }
});

// Get chat by ID
router.get('/:chatId', async (req, res) => {
    try {
        const { chatId } = req.params;

        const chat = await Chat.findById(chatId)
            .populate('participants', 'username avatar online lastSeen status')
            .populate('groupAdmin', 'username avatar')
            .populate('lastMessage');

        if (!chat) {
            return res.status(404).json({ error: 'Chat not found' });
        }

        res.json(chat);
    } catch (error) {
        console.error('Get chat error:', error);
        res.status(500).json({ error: 'Failed to fetch chat' });
    }
});

module.exports = router;