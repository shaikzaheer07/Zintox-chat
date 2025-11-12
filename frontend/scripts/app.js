
// Main application controller
class WhatsAppApp {
    constructor() {
        this.currentUser = null;
        this.activeChat = null;
        this.chats = [];
        this.users = [];
        this.socket = null;
        
        console.log('🚀 WhatsApp App constructor called');
        
        // Wait for DOM to be fully loaded before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                console.log('✅ DOM fully loaded');
                this.initializeApp();
            });
        } else {
            console.log('✅ DOM already loaded');
            this.initializeApp();
        }
    }
    
    async initializeApp() {
        console.log('🚀 Initializing WhatsApp App...');
        
        // First hide loading screen and show login screen immediately
        this.hideLoadingScreen();
        this.showLoginScreen();
        
        // Then setup event listeners for elements that exist
        this.setupGlobalEventListeners();
        
        // Then check authentication
        await this.checkAuthentication();
    }
    
    hideLoadingScreen() {
        console.log('📱 Hiding loading screen');
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            console.log('✅ Loading screen hidden');
        } else {
            console.log('❌ Loading screen element not found');
        }
    }
    
    setupGlobalEventListeners() {
        console.log('🔗 Setting up global event listeners...');
        
        // Tab switching - these elements should exist in login screen
        const tabButtons = document.querySelectorAll('.tab-button');
        console.log(`Found ${tabButtons.length} tab buttons`);
        
        if (tabButtons.length > 0) {
            tabButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const tab = e.target.getAttribute('data-tab');
                    console.log(`Switching to tab: ${tab}`);
                    this.switchTab(tab);
                });
            });
        }
        
        // Form submissions - these elements should exist in login screen
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            console.log('✅ Login form found, adding listener');
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Login form submitted');
                this.handleLogin();
            });
        } else {
            console.log('❌ Login form not found');
        }
        
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            console.log('✅ Register form found, adding listener');
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('Register form submitted');
                this.handleRegister();
            });
        } else {
            console.log('❌ Register form not found');
        }
        
        // Log all form elements for debugging
        console.log('All form elements:', {
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            loginEmail: document.getElementById('login-email'),
            loginPassword: document.getElementById('login-password'),
            registerUsername: document.getElementById('register-username'),
            registerEmail: document.getElementById('register-email'),
            registerPhone: document.getElementById('register-phone'),
            registerPassword: document.getElementById('register-password')
        });
    }
    
    switchTab(tab) {
        console.log(`🔄 Switching to tab: ${tab}`);
        
        // Update active tab button
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        const activeTabBtn = document.querySelector(`[data-tab="${tab}"]`);
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
            console.log(`✅ Activated tab button: ${tab}`);
        } else {
            console.log(`❌ Tab button not found: ${tab}`);
        }
        
        // Show active form
        document.querySelectorAll('.form-content').forEach(form => {
            form.classList.remove('active');
        });
        const activeForm = document.getElementById(`${tab}-form`);
        if (activeForm) {
            activeForm.classList.add('active');
            console.log(`✅ Activated form: ${tab}-form`);
        } else {
            console.log(`❌ Form not found: ${tab}-form`);
        }
    }
    
    async checkAuthentication() {
        console.log('🔐 Checking authentication...');
        const token = localStorage.getItem('whatsapp_token');
        console.log('Token found:', !!token);
        
        if (!token) {
            console.log('❌ No token found, showing login screen');
            this.showLoginScreen();
            return;
        }
        
        try {
            console.log('🔄 Validating token with server...');
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                console.log('✅ User authenticated:', data.user.username);
                this.showMainApp();
            } else {
                console.log('❌ Token validation failed');
                localStorage.removeItem('whatsapp_token');
                this.showLoginScreen();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('whatsapp_token');
            this.showLoginScreen();
        }
    }
    
    async handleLogin() {
        console.log('🔐 Handling login...');
        
        const email = document.getElementById('login-email');
        const password = document.getElementById('login-password');
        
        if (!email || !password) {
            alert('Login form not found');
            return;
        }
        
        console.log('Login credentials:', { email: email.value, password: '***' });
        
        const loginBtn = document.querySelector('#login-form .submit-btn');
        if (loginBtn) {
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    email: email.value, 
                    password: password.value 
                })
            });
            
            console.log('Login response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Login successful:', data.user.username);
                this.currentUser = data.user;
                localStorage.setItem('whatsapp_token', data.token);
                
                // Initialize socket after successful login
                this.socket = io();
                await this.loadInitialData();
                this.setupSocketListeners();
                this.socket.emit('user_connected', this.currentUser.id);
                this.showMainApp();
            } else {
                const error = await response.json();
                console.log('❌ Login failed:', error);
                alert('Login failed: ' + error.error);
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed: Network error');
        } finally {
            if (loginBtn) {
                loginBtn.textContent = 'Login';
                loginBtn.disabled = false;
            }
        }
    }
    
    async handleRegister() {
        console.log('📝 Handling registration...');
        
        const username = document.getElementById('register-username');
        const email = document.getElementById('register-email');
        const phone = document.getElementById('register-phone');
        const password = document.getElementById('register-password');
        
        if (!username || !email || !phone || !password) {
            alert('Registration form not found');
            return;
        }
        
        console.log('Registration data:', { 
            username: username.value, 
            email: email.value, 
            phone: phone.value, 
            password: '***' 
        });
        
        const registerBtn = document.querySelector('#register-form .submit-btn');
        if (registerBtn) {
            registerBtn.textContent = 'Creating Account...';
            registerBtn.disabled = true;
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    username: username.value,
                    email: email.value, 
                    phone: phone.value,
                    password: password.value 
                })
            });
            
            console.log('Register response status:', response.status);
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Registration successful:', data.user.username);
                this.currentUser = data.user;
                localStorage.setItem('whatsapp_token', data.token);
                
                // Initialize socket after successful registration
                this.socket = io();
                await this.loadInitialData();
                this.setupSocketListeners();
                this.socket.emit('user_connected', this.currentUser.id);
                this.showMainApp();
            } else {
                const error = await response.json();
                console.log('❌ Registration failed:', error);
                alert('Registration failed: ' + error.error);
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed: Network error');
        } finally {
            if (registerBtn) {
                registerBtn.textContent = 'Create Account';
                registerBtn.disabled = false;
            }
        }
    }
    


    async loadInitialData() {
    try {
        console.log('📦 Loading initial data...');
        
        // Load chats and users
        await this.loadChats();
        await this.loadUsers();
        
        // Update user profile in the UI
        this.updateUserProfile();
        
        console.log('✅ Initial data loaded successfully');
    } catch (error) {
        console.error('❌ Failed to load initial data:', error);
        this.uiManager.showError('Failed to load initial data');
    }
}

async loadChats() {
    try {
        console.log('💬 Loading chats...');
        const response = await fetch(`/api/chats/user/${this.currentUser.id}`);
        if (response.ok) {
            this.chats = await response.json();
            this.renderChatList();
            console.log(`✅ Loaded ${this.chats.length} chats`);
        } else {
            console.error('Failed to load chats:', response.status);
        }
    } catch (error) {
        console.error('Failed to load chats:', error);
    }
}

async loadUsers() {
    try {
        console.log('👥 Loading users...');
        const response = await fetch(`/api/users?exclude=${this.currentUser.id}`);
        if (response.ok) {
            this.users = await response.json();
            console.log(`✅ Loaded ${this.users.length} users`);
        } else {
            console.error('Failed to load users:', response.status);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

updateUserProfile() {
    if (this.currentUser) {
        console.log('👤 Updating user profile:', this.currentUser.username);
        const userAvatar = document.getElementById('user-avatar');
        const userName = document.getElementById('user-name');
        const userStatus = document.getElementById('user-status');
        
        if (userAvatar) {
            userAvatar.textContent = this.currentUser.avatar || this.currentUser.username.charAt(0).toUpperCase();
        }
        if (userName) {
            userName.textContent = this.currentUser.username;
        }
        if (userStatus) {
            userStatus.textContent = 'Online';
        }
    }
}

renderChatList() {
    const chatList = document.getElementById('chat-list');
    if (!chatList) {
        console.log('❌ Chat list element not found');
        return;
    }
    
    console.log(`💬 Rendering ${this.chats.length} chats`);
    chatList.innerHTML = '';
    
    if (this.chats.length === 0) {
        chatList.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #8696a0;">
                <p>No chats yet</p>
                <p>Start a new conversation!</p>
            </div>
        `;
        return;
    }
    
    this.chats.forEach(chat => {
        const otherParticipants = chat.participants.filter(p => p._id !== this.currentUser.id);
        const chatName = chat.isGroup ? 
            chat.groupName : 
            otherParticipants[0]?.username || 'Unknown';
        
        const chatAvatar = chat.isGroup ? 
            '👥' : 
            otherParticipants[0]?.avatar || otherParticipants[0]?.username?.charAt(0).toUpperCase() || 'U';
        
        const lastMessage = chat.lastMessage?.content || 'No messages yet';
        const time = new Date(chat.updatedAt).toLocaleTimeString([], { 
            hour: '2-digit', minute: '2-digit' 
        });
        
        const chatItem = document.createElement('div');
        chatItem.className = 'chat-item';
        chatItem.innerHTML = `
            <div class="chat-avatar">${chatAvatar}</div>
            <div class="chat-details">
                <span class="chat-name">${chatName}</span>
                <span class="chat-last-message">${lastMessage}</span>
            </div>
            <div class="chat-time">${time}</div>
        `;
        
        chatItem.addEventListener('click', () => {
            this.selectChat(chat);
        });
        
        chatList.appendChild(chatItem);
    });
}


setupAppEventListeners() {
    console.log('🔗 Setting up app event listeners...');
    
    // Modal controls
    const newChatBtn = document.getElementById('new-chat-btn');
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            this.showNewChatModal();
        });
    }
    
    const closeModalBtn = document.getElementById('close-modal');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            this.hideNewChatModal();
        });
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            this.handleLogout();
        });
    }
    
    // User search
    const userSearch = document.getElementById('user-search');
    if (userSearch) {
        userSearch.addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });
    }
    
    // Click outside modal to close
    const modal = document.getElementById('new-chat-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'new-chat-modal') {
                this.hideNewChatModal();
            }
        });
    }
}


    // ... rest of the methods remain the same as previous version, but let me add the showLoginScreen method:
    
    showLoginScreen() {
        console.log('📱 Showing login screen');
        this.hideAllScreens();
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) {
            loginScreen.classList.remove('hidden');
            console.log('✅ Login screen shown');
        } else {
            console.log('❌ Login screen element not found');
        }
    }
    
    showMainApp() {
        console.log('📱 Showing main app screen');
        this.hideAllScreens();
        const appScreen = document.getElementById('app-screen');
        if (appScreen) {
            appScreen.classList.remove('hidden');
            console.log('✅ Main app screen shown');
            // Setup app-specific event listeners now that the app screen is visible
            this.setupAppEventListeners();
        } else {
            console.log('❌ App screen element not found');
        }
    }
    
    setupSocketListeners() {
    if (!this.socket) {
        console.error('Socket not initialized');
        return;
    }
    
    console.log('🔌 Setting up Socket.IO listeners...');
    
    this.socket.on('connect', () => {
        console.log('✅ Connected to server via Socket.IO');
    });
    
    this.socket.on('disconnect', () => {
        console.log('❌ Disconnected from server');
    });
    
    this.socket.on('new_message', (message) => {
        this.handleNewMessage(message);
    });
    
    this.socket.on('user_online', (userId) => {
        this.updateUserStatus(userId, true);
    });
    
    this.socket.on('user_offline', (userId) => {
        this.updateUserStatus(userId, false);
    });
    
    this.socket.on('user_typing', (data) => {
        this.showTypingIndicator(data.userId, data.chatId, data.typing);
    });
}

handleNewMessage(message) {
    console.log('📨 New message received:', message);
    
    // Update chat list with new last message
    this.chats = this.chats.map(chat => {
        if (chat._id === message.chat) {
            return {
                ...chat,
                lastMessage: message,
                updatedAt: new Date()
            };
        }
        return chat;
    });
    
    this.renderChatList();
    
    // If this message is for the active chat, display it
    if (this.activeChat && this.activeChat._id === message.chat) {
        this.renderMessage(message);
    }
}

updateUserStatus(userId, online) {
    console.log(`👤 User ${userId} is ${online ? 'online' : 'offline'}`);
    
    // Update in users list
    this.users = this.users.map(user => 
        user._id === userId ? { ...user, online } : user
    );
    
    // Update in chats
    this.chats = this.chats.map(chat => ({
        ...chat,
        participants: chat.participants.map(participant =>
            participant._id === userId ? { ...participant, online } : participant
        )
    }));
    
    this.renderChatList();
    
    // Update active chat status
    if (this.activeChat && !this.activeChat.isGroup) {
        const otherUser = this.activeChat.participants.find(p => p._id === userId);
        if (otherUser) {
            const statusElement = document.getElementById('current-chat-status');
            if (statusElement) {
                statusElement.textContent = online ? 'Online' : 'Offline';
            }
        }
    }
}

showTypingIndicator(userId, chatId, typing) {
    const typingIndicator = document.getElementById('typing-indicator');
    const typingText = document.getElementById('typing-text');
    
    if (typingIndicator && typingText) {
        if (typing && this.activeChat && this.activeChat._id === chatId) {
            // Find the username of the typing user
            const typingUser = this.users.find(u => u._id === userId);
            const username = typingUser ? typingUser.username : 'Someone';
            typingText.textContent = `${username} is typing...`;
            typingIndicator.style.display = 'block';
        } else {
            typingIndicator.style.display = 'none';
        }
    }
}

renderMessage(message) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    // Remove welcome message if it exists
    const welcomeMsg = messagesContainer.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }
    
    const isSent = message.sender._id === this.currentUser.id;
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    messageDiv.innerHTML = `
        ${isSent ? '' : `<div class="message-sender">${message.sender.username}</div>`}
        <div class="message-content">${message.content}</div>
        <div class="message-time">
            ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async searchUsers(query) {
    if (query.length < 2) {
        this.renderUsersList(this.users);
        return;
    }
    
    try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (response.ok) {
            const users = await response.json();
            this.renderUsersList(users);
        }
    } catch (error) {
        console.error('Search failed:', error);
    }
}

renderUsersList(users) {
    const usersList = document.getElementById('users-list');
    if (!usersList) return;
    
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userItem = document.createElement('div');
        userItem.className = 'user-item';
        userItem.innerHTML = `
            <div class="user-avatar">${user.avatar || user.username.charAt(0).toUpperCase()}</div>
            <div class="user-details">
                <div class="user-name">${user.username}</div>
                <div class="user-status">${user.status || 'Hey there! I am using WhatsApp Clone'}</div>
            </div>
            <div class="user-status-indicator ${user.online ? 'online' : ''}"></div>
        `;
        
        userItem.addEventListener('click', () => {
            this.createPrivateChat(user);
        });
        
        usersList.appendChild(userItem);
    });
}

async createPrivateChat(user) {
    try {
        console.log(`💬 Creating chat with ${user.username}`);
        const response = await fetch('/api/chats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                participants: [this.currentUser.id, user._id],
                isGroup: false
            })
        });
        
        if (response.ok) {
            const newChat = await response.json();
            this.chats.unshift(newChat);
            this.renderChatList();
            this.hideNewChatModal();
            this.selectChat(newChat);
            console.log('✅ Chat created successfully');
        } else {
            console.error('Failed to create chat:', response.status);
        }
    } catch (error) {
        console.error('Failed to create chat:', error);
        alert('Failed to create chat');
    }
}

showNewChatModal() {
    const modal = document.getElementById('new-chat-modal');
    if (modal) {
        modal.classList.remove('hidden');
        this.renderUsersList(this.users);
        console.log('✅ New chat modal shown');
    }
}

hideNewChatModal() {
    const modal = document.getElementById('new-chat-modal');
    const userSearch = document.getElementById('user-search');
    
    if (modal) modal.classList.add('hidden');
    if (userSearch) userSearch.value = '';
    
    console.log('✅ New chat modal hidden');
}

async selectChat(chat) {
    this.activeChat = chat;
    
    const otherParticipants = chat.participants.filter(p => p._id !== this.currentUser.id);
    const chatName = chat.isGroup ? chat.groupName : otherParticipants[0]?.username;
    const chatAvatar = chat.isGroup ? '👥' : otherParticipants[0]?.avatar || otherParticipants[0]?.username?.charAt(0).toUpperCase();
    const isOnline = chat.isGroup ? null : otherParticipants[0]?.online;
    
    // Update chat header
    const chatNameElement = document.getElementById('current-chat-name');
    const chatAvatarElement = document.getElementById('current-chat-avatar');
    const chatStatusElement = document.getElementById('current-chat-status');
    
    if (chatNameElement) chatNameElement.textContent = chatName || 'Unknown';
    if (chatAvatarElement) chatAvatarElement.textContent = chatAvatar;
    if (chatStatusElement) {
        chatStatusElement.textContent = chat.isGroup ? 
            `${chat.participants.length} participants` : 
            (isOnline ? 'Online' : 'Offline');
    }
    
    // Show message input
    const messageInputArea = document.getElementById('message-input-area');
    if (messageInputArea) {
        messageInputArea.style.display = 'block';
    }
    
    // Load messages
    await this.loadChatMessages(chat._id);
    
    // Join chat room for real-time updates
    if (this.socket) {
        this.socket.emit('join_chat', chat._id);
    }
    
    // Setup message sending
    this.setupMessageSending();
    
    console.log(`✅ Selected chat: ${chatName}`);
}

async loadChatMessages(chatId) {
    try {
        const response = await fetch(`/api/messages/chat/${chatId}`);
        if (response.ok) {
            const data = await response.json();
            this.renderMessages(data.messages);
        }
    } catch (error) {
        console.error('Failed to load messages:', error);
    }
}

renderMessages(messages) {
    const messagesContainer = document.getElementById('messages-container');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = `
            <div class="welcome-message">
                <h3>No messages yet</h3>
                <p>Start the conversation!</p>
            </div>
        `;
        return;
    }
    
    messages.forEach(message => {
        this.renderMessage(message);
    });
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

setupMessageSending() {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
    if (!messageInput || !sendButton) return;
    
    // Remove existing event listeners by cloning elements
    const newSendButton = sendButton.cloneNode(true);
    sendButton.parentNode.replaceChild(newSendButton, sendButton);
    
    const newMessageInput = messageInput.cloneNode(true);
    messageInput.parentNode.replaceChild(newMessageInput, messageInput);
    
    // Add new event listeners
    newSendButton.addEventListener('click', () => {
        this.sendMessage();
    });
    
    newMessageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            this.sendMessage();
        }
    });
    
    // Typing detection
    newMessageInput.addEventListener('input', () => {
        this.handleTyping();
    });
    
    console.log('✅ Message sending setup complete');
}

sendMessage() {
    const messageInput = document.getElementById('message-input');
    const content = messageInput ? messageInput.value.trim() : '';
    
    if (!content || !this.activeChat || !this.socket) return;
    
    console.log('📤 Sending message:', content);
    
    this.socket.emit('send_message', {
        chatId: this.activeChat._id,
        senderId: this.currentUser.id,
        content: content,
        messageType: 'text'
    });
    
    if (messageInput) {
        messageInput.value = '';
    }
}

handleTyping() {
    if (!this.activeChat || !this.socket) return;
    
    // Start typing
    this.socket.emit('typing_start', {
        chatId: this.activeChat._id,
        userId: this.currentUser.id
    });
    
    // Stop typing after 1 second of inactivity
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
        this.socket.emit('typing_stop', {
            chatId: this.activeChat._id,
            userId: this.currentUser.id
        });
    }, 1000);
}

handleLogout() {
    console.log('🚪 Logging out...');
    localStorage.removeItem('whatsapp_token');
    if (this.socket) {
        this.socket.disconnect();
    }
    this.currentUser = null;
    this.activeChat = null;
    this.chats = [];
    this.users = [];
    this.socket = null;
    this.showLoginScreen();
    console.log('✅ Logged out successfully');
}



    hideAllScreens() {
        console.log('📱 Hiding all screens');
        const screens = document.querySelectorAll('.screen');
        console.log(`Found ${screens.length} screens`);
        screens.forEach(screen => {
            screen.classList.add('hidden');
        });
    }
    
    // ... include all the other methods from the previous version (setupAppEventListeners, loadInitialData, etc.)
    // Make sure to copy all the remaining methods from the previous version
    
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM fully loaded, initializing WhatsApp App...');
    window.whatsappApp = new WhatsAppApp();
});