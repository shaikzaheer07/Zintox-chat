const mongoose = require('mongoose');
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');
require('dotenv').config();

const connectDB = require('./config/database');
connectDB();

const seedData = async () => {
    try {
        // Clear existing data
        await User.deleteMany({});
        await Chat.deleteMany({});
        await Message.deleteMany({});

        console.log('🗑️  Cleared existing data');

        // Create users
        const users = await User.create([
            {
                username: 'john_doe',
                email: 'john@example.com',
                phone: '+1234567890',
                password: 'password123',
                avatar: 'J',
                status: 'Hello! I am using WhatsApp Clone'
            },
            {
                username: 'jane_smith',
                email: 'jane@example.com',
                phone: '+1234567891',
                password: 'password123',
                avatar: 'J',
                status: 'Available for chat'
            },
            {
                username: 'mike_wilson',
                email: 'mike@example.com',
                phone: '+1234567892',
                password: 'password123',
                avatar: 'M',
                status: 'At work'
            }
        ]);

        console.log('👥 Created users:', users.map(u => u.username));

        // Create chats
        const chats = await Chat.create([
            {
                participants: [users[0]._id, users[1]._id],
                isGroup: false
            },
            {
                participants: [users[0]._id, users[2]._id],
                isGroup: false
            },
            {
                participants: [users[0]._id, users[1]._id, users[2]._id],
                isGroup: true,
                groupName: 'Friends Group',
                groupDescription: 'Our awesome friend group'
            }
        ]);

        console.log('💬 Created chats');

        // Create sample messages
        const messages = await Message.create([
            {
                chat: chats[0]._id,
                sender: users[1]._id,
                content: 'Hey John! How are you doing?',
                messageType: 'text'
            },
            {
                chat: chats[0]._id,
                sender: users[0]._id,
                content: 'Hi Jane! I\'m good, working on a new project.',
                messageType: 'text'
            },
            {
                chat: chats[1]._id,
                sender: users[2]._id,
                content: 'Are we meeting tomorrow?',
                messageType: 'text'
            },
            {
                chat: chats[2]._id,
                sender: users[1]._id,
                content: 'Hey everyone! How about dinner tonight?',
                messageType: 'text'
            }
        ]);

        console.log('📨 Created sample messages');

        // Update chats with last messages
        for (let chat of chats) {
            const lastMessage = await Message.findOne({ chat: chat._id }).sort({ timestamp: -1 });
            chat.lastMessage = lastMessage._id;
            await chat.save();
        }

        console.log('✅ Database seeded successfully!');
        console.log(`📊 Stats: ${users.length} users, ${chats.length} chats, ${messages.length} messages`);
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

seedData();