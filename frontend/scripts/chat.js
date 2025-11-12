// Chat management functionality
class ChatManager {
    constructor(app) {
        this.app = app;
    }
    
    async loadMessages(chatId) {
        try {
            const response = await fetch(`/api/messages/chat/${chatId}`);
            const data = await response.json();
            this.renderMessages(data.messages);
            
            // Mark messages as read
            const unreadMessages = data.messages.filter(msg => 
                !msg.readBy.includes(this.app.currentUser.id)
            );
            
            if (unreadMessages.length > 0) {
                this.markMessagesAsRead(unreadMessages.map(msg => msg._id));
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }
    
    async sendMessage(content, messageType = 'text', mediaUrl = null) {
        if (!this.app.activeChat) return;
        
        this.app.socket.emit('send_message', {
            chatId: this.app.activeChat._id,
            senderId: this.app.currentUser.id,
            content,
            messageType,
            mediaUrl
        });
    }
    
    // ... other chat-related methods
}