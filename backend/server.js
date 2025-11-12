
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const userRoutes = require('./routes/users');

// Import models at the top to avoid circular requires
const User = require('./models/User');
const Message = require('./models/Message');
const Chat = require('./models/Chat');
const Call = require('./models/Call');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CLIENT_URL || "*",
        methods: ["GET", "POST"]
    }
});

// Connect to database with error handling
connectDB().catch(error => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Logging middleware
app.use((req, res, next) => {
    console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});



// Routes
app.use('/api/auth', authRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// Single test route (removed duplicate)
app.get('/api/test', (req, res) => {
    res.json({ 
        message: 'Server is working with MongoDB!',
        timestamp: new Date().toISOString(),
        status: 'All systems operational',
        routes: {
            auth: '/api/auth',
            chats: '/api/chats', 
            messages: '/api/messages',
            users: '/api/users'
        }
    });
});

// Debug static file serving
app.use('/debug', express.static(path.join(__dirname, '../frontend'), {
    setHeaders: (res, path) => {
        console.log('Serving static file:', path);
    }
}));

// Test route to check if server is running
app.get('/debug/server', (req, res) => {
    res.json({ 
        message: 'Server is running',
        timestamp: new Date().toISOString(),
        staticFiles: 'Check /debug path for frontend files'
    });
});

// Serve frontend with error handling
app.get('*', (req, res) => {
    const frontendPath = path.join(__dirname, '../frontend/index.html');
    res.sendFile(frontendPath, (err) => {
        if (err) {
            console.error('Error serving frontend:', err);
            res.status(404).json({ 
                error: 'Frontend not found', 
                message: 'Please build the frontend first' 
            });
        }
    });
});

// Socket.IO Connection Handling
const connectedUsers = new Map();
const typingUsers = new Map();

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // User authentication and joining
    socket.on('user_connected', async (userId) => {
        if (!userId) {
            socket.emit('error', { message: 'User ID is required' });
            return;
        }

        connectedUsers.set(userId, socket.id);
        console.log(`User ${userId} connected`);
        
        try {
            await User.findByIdAndUpdate(userId, { 
                online: true, 
                lastSeen: new Date() 
            });
            
            socket.broadcast.emit('user_online', userId);
        } catch (error) {
            console.error('User connection error:', error);
            socket.emit('error', { message: 'Failed to update user status' });
        }
    });

    // Join chat room
    socket.on('join_chat', (chatId) => {
        if (!chatId) {
            socket.emit('error', { message: 'Chat ID is required' });
            return;
        }
        socket.join(chatId);
        console.log(`User joined chat: ${chatId}`);
    });

    // Real-time messaging
    socket.on('send_message', async (data) => {
        try {
            const { chatId, senderId, content, messageType = 'text', mediaUrl, repliedTo } = data;
            
            // Input validation
            if (!chatId || !senderId || !content) {
                socket.emit('message_error', { error: 'Missing required fields' });
                return;
            }

            const message = new Message({
                chat: chatId,
                sender: senderId,
                content: content.trim(),
                messageType,
                mediaUrl,
                repliedTo
            });
            
            await message.save();
            await message.populate('sender', 'username avatar');
            
            // Update chat's last message
            await Chat.findByIdAndUpdate(chatId, { 
                lastMessage: message._id,
                updatedAt: new Date()
            });
            
            // Send to all participants in the chat room
            io.to(chatId).emit('new_message', message);
            
            // Handle delivery receipts
            const chat = await Chat.findById(chatId).populate('participants');
            if (chat && chat.participants) {
                chat.participants.forEach(participant => {
                    if (participant._id.toString() !== senderId) {
                        const participantSocketId = connectedUsers.get(participant._id.toString());
                        if (participantSocketId) {
                            setTimeout(() => {
                                io.to(participantSocketId).emit('message_delivered', {
                                    messageId: message._id,
                                    chatId: chatId
                                });
                            }, 1000);
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message_error', { error: 'Failed to send message' });
        }
    });

    // Typing indicators
    socket.on('typing_start', (data) => {
        const { chatId, userId } = data;
        if (!chatId || !userId) return;
        
        typingUsers.set(userId, { chatId, typing: true });
        socket.to(chatId).emit('user_typing', { chatId, userId, typing: true });
    });

    socket.on('typing_stop', (data) => {
        const { chatId, userId } = data;
        if (!chatId || !userId) return;
        
        typingUsers.delete(userId);
        socket.to(chatId).emit('user_typing', { chatId, userId, typing: false });
    });

    // Message read receipts
    socket.on('mark_messages_read', async (data) => {
        try {
            const { messageIds, userId, chatId } = data;
            
            if (!messageIds || !userId || !chatId) {
                socket.emit('error', { message: 'Missing required fields' });
                return;
            }

            await Message.updateMany(
                { _id: { $in: messageIds } },
                { $addToSet: { readBy: userId } }
            );
            
            // Notify other participants
            socket.to(chatId).emit('messages_read', {
                messageIds,
                userId
            });
            
        } catch (error) {
            console.error('Error marking messages as read:', error);
            socket.emit('error', { message: 'Failed to mark messages as read' });
        }
    });

    // WebRTC Signaling
    socket.on('webrtc_offer', (data) => {
        const { targetUserId, offer, callId } = data;
        if (!targetUserId || !offer || !callId) return;
        
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_offer', { offer, callId, from: socket.id });
        }
    });

    socket.on('webrtc_answer', (data) => {
        const { targetUserId, answer, callId } = data;
        if (!targetUserId || !answer || !callId) return;
        
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_answer', { answer, callId, from: socket.id });
        }
    });

    socket.on('webrtc_ice_candidate', (data) => {
        const { targetUserId, candidate, callId } = data;
        if (!targetUserId || !candidate || !callId) return;
        
        const targetSocketId = connectedUsers.get(targetUserId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('webrtc_ice_candidate', { candidate, callId, from: socket.id });
        }
    });

    // Call management
    socket.on('initiate_call', async (data) => {
        try {
            const { callerId, receiverId, callType } = data;
            
            if (!callerId || !receiverId || !callType) {
                socket.emit('error', { message: 'Missing required call fields' });
                return;
            }

            const call = new Call({
                caller: callerId,
                receiver: receiverId,
                callType,
                status: 'ringing'
            });
            await call.save();
            
            const receiverSocketId = connectedUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('incoming_call', {
                    callId: call._id,
                    callerId,
                    callType
                });
            }
            
        } catch (error) {
            console.error('Error initiating call:', error);
            socket.emit('error', { message: 'Failed to initiate call' });
        }
    });

    socket.on('answer_call', async (data) => {
        try {
            const { callId, answer } = data;
            if (!callId) {
                socket.emit('error', { message: 'Call ID is required' });
                return;
            }

            const call = await Call.findById(callId);
            if (!call) {
                socket.emit('error', { message: 'Call not found' });
                return;
            }
            
            if (answer) {
                call.status = 'answered';
                call.startTime = new Date();
                
                const callerSocketId = connectedUsers.get(call.caller.toString());
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call_answered', { callId });
                }
            } else {
                call.status = 'rejected';
                call.endTime = new Date();
                
                const callerSocketId = connectedUsers.get(call.caller.toString());
                if (callerSocketId) {
                    io.to(callerSocketId).emit('call_rejected', { callId });
                }
            }
            
            await call.save();
            
        } catch (error) {
            console.error('Error answering call:', error);
            socket.emit('error', { message: 'Failed to answer call' });
        }
    });

    socket.on('end_call', async (data) => {
        try {
            const { callId } = data;
            if (!callId) {
                socket.emit('error', { message: 'Call ID is required' });
                return;
            }

            const call = await Call.findById(callId);
            if (!call) {
                socket.emit('error', { message: 'Call not found' });
                return;
            }
            
            call.status = 'ended';
            call.endTime = new Date();
            
            if (call.startTime) {
                call.duration = Math.floor((call.endTime - call.startTime) / 1000);
            }
            
            await call.save();
            
            // Notify both parties
            const callerSocketId = connectedUsers.get(call.caller.toString());
            const receiverSocketId = connectedUsers.get(call.receiver.toString());
            
            if (callerSocketId) io.to(callerSocketId).emit('call_ended', { callId });
            if (receiverSocketId) io.to(receiverSocketId).emit('call_ended', { callId });
            
        } catch (error) {
            console.error('Error ending call:', error);
            socket.emit('error', { message: 'Failed to end call' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        
        for (let [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                
                try {
                    await User.findByIdAndUpdate(userId, { 
                        online: false, 
                        lastSeen: new Date() 
                    });
                    
                    socket.broadcast.emit('user_offline', userId);
                } catch (error) {
                    console.error('User disconnect error:', error);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});