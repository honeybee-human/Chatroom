// Initialize Socket.IO connection
const socket = io();

// DOM elements
const messagesContainer = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usernameDisplay = document.getElementById('username');
const userCountDisplay = document.getElementById('user-count');
const favoritesList = document.getElementById('favorites-list');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');

// Current user info
let currentUsername = '';
let currentUserColor = '';
let userFavorites = [];
let editingMessageId = null;

// Add message to chat
function addMessage(data, type = 'other') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.dataset.messageId = data.id;
    
    if (type === 'system') {
        messageDiv.innerHTML = `<div class="message-content">${data.message}</div>`;
    } else {
        const isOwn = data.username === currentUsername;
        const isFavorited = userFavorites.includes(data.id);
        const editedText = data.edited ? `<span class="edited-indicator">(edited ${data.editedAt})</span>` : '';
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span style="color: ${isOwn ? 'rgba(255,255,255,0.8)' : data.color}; font-weight: 600;">
                    ${data.username}
                </span>
                <div class="message-actions">
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-message-id="${data.id}">
                        <i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    ${isOwn ? `
                        <button class="edit-btn" data-message-id="${data.id}">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="delete-btn" data-message-id="${data.id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                    <span style="opacity: 0.6; font-size: 0.75rem;">${data.timestamp}${editedText}</span>
                </div>
            </div>
            <div class="message-content" data-message-id="${data.id}">${escapeHtml(data.message)}</div>
            ${isOwn ? `
                <div class="message-controls hidden" data-message-id="${data.id}">
                    <button class="save-btn" data-message-id="${data.id}">
                        <i class="fas fa-check"></i> Save
                    </button>
                    <button class="cancel-btn" data-message-id="${data.id}">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            ` : ''}
        `;
        
        if (isOwn) {
            messageDiv.classList.add('own');
        }
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update message in chat
function updateMessage(data) {
    const messageDiv = document.querySelector(`[data-message-id="${data.id}"]`);
    if (messageDiv) {
        const contentDiv = messageDiv.querySelector('.message-content');
        const actionsDiv = messageDiv.querySelector('.message-actions');
        
        if (contentDiv) {
            contentDiv.textContent = data.message;
        }
        
        // Update edited indicator
        if (actionsDiv) {
            const timestampSpan = actionsDiv.querySelector('span');
            if (timestampSpan) {
                const editedText = data.edited ? `<span class="edited-indicator">(edited ${data.editedAt})</span>` : '';
                timestampSpan.innerHTML = `${data.timestamp}${editedText}`;
            }
        }
    }
}

// Remove message from chat
function removeMessage(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageDiv) {
        messageDiv.remove();
    }
}

// Start editing message
function startEditMessage(messageId) {
    if (editingMessageId) {
        cancelEdit(editingMessageId);
    }
    
    editingMessageId = messageId;
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const contentDiv = messageDiv.querySelector('.message-content');
    const controlsDiv = messageDiv.querySelector('.message-controls');
    
    const currentText = contentDiv.textContent;
    
    // Create edit input
    const editInput = document.createElement('input');
    editInput.type = 'text';
    editInput.className = 'edit-input';
    editInput.value = currentText;
    editInput.maxLength = 500;
    
    // Hide content and show input
    contentDiv.classList.add('editing');
    contentDiv.after(editInput);
    controlsDiv.classList.remove('hidden');
    
    editInput.focus();
    editInput.select();
    
    // Handle Enter key
    editInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            saveEdit(messageId);
        } else if (e.key === 'Escape') {
            cancelEdit(messageId);
        }
    });
}

// Save edited message
function saveEdit(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const editInput = messageDiv.querySelector('.edit-input');
    const newMessage = editInput.value.trim();
    
    if (newMessage && newMessage.length > 0) {
        socket.emit('edit-message', {
            messageId: messageId,
            newMessage: newMessage
        });
    }
    
    cancelEdit(messageId);
}

// Cancel editing
function cancelEdit(messageId) {
    const messageDiv = document.querySelector(`[data-message-id="${messageId}"]`);
    const contentDiv = messageDiv.querySelector('.message-content');
    const editInput = messageDiv.querySelector('.edit-input');
    const controlsDiv = messageDiv.querySelector('.message-controls');
    
    if (editInput) {
        editInput.remove();
    }
    
    contentDiv.classList.remove('editing');
    controlsDiv.classList.add('hidden');
    editingMessageId = null;
}

// Update favorites display
function updateFavoritesDisplay(favorites) {
    userFavorites = favorites.map(msg => msg.id);
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="no-favorites">No favorite messages yet</div>';
    } else {
        favoritesList.innerHTML = favorites.map(msg => {
            const editedText = msg.edited ? ` (edited ${msg.editedAt})` : '';
            return `
                <div class="favorite-message" data-message-id="${msg.id}">
                    <div class="message-header">
                        <span style="color: ${msg.color}; font-weight: 600;">
                            ${msg.username} • ${msg.timestamp}${editedText}
                        </span>
                        <button class="remove-favorite-btn" data-message-id="${msg.id}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div>${escapeHtml(msg.message)}</div>
                </div>
            `;
        }).join('');
    }
    
    // Update heart icons in main chat
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const messageId = parseInt(btn.dataset.messageId);
        const isFavorited = userFavorites.includes(messageId);
        btn.classList.toggle('favorited', isFavorited);
        btn.innerHTML = `<i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>`;
    });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Send message
function sendMessage() {
    const message = messageInput.value.trim();
    if (message && currentUsername) {
        socket.emit('chat-message', { message });
        messageInput.value = '';
        sendButton.disabled = true;
        setTimeout(() => {
            sendButton.disabled = false;
        }, 500);
    }
}

// Event listeners
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

messageInput.addEventListener('input', () => {
    sendButton.disabled = messageInput.value.trim() === '';
});

// Message action button clicks
messagesContainer.addEventListener('click', (e) => {
    const messageId = parseInt(e.target.closest('button')?.dataset.messageId);
    
    if (e.target.closest('.favorite-btn')) {
        socket.emit('toggle-favorite', messageId);
    } else if (e.target.closest('.edit-btn')) {
        startEditMessage(messageId);
    } else if (e.target.closest('.delete-btn')) {
        if (confirm('Are you sure you want to delete this message?')) {
            socket.emit('delete-message', messageId);
        }
    } else if (e.target.closest('.save-btn')) {
        saveEdit(messageId);
    } else if (e.target.closest('.cancel-btn')) {
        cancelEdit(messageId);
    }
});

// Remove favorite button clicks in sidebar
favoritesList.addEventListener('click', (e) => {
    if (e.target.closest('.remove-favorite-btn')) {
        const btn = e.target.closest('.remove-favorite-btn');
        const messageId = parseInt(btn.dataset.messageId);
        socket.emit('toggle-favorite', messageId);
    }
});

// Emoji picker
emojiButton.addEventListener('click', () => {
    emojiPicker.classList.toggle('show');
});

emojiPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji')) {
        messageInput.value += e.target.textContent;
        emojiPicker.classList.remove('show');
        messageInput.focus();
    }
});

// Close emoji picker when clicking outside
document.addEventListener('click', (e) => {
    if (!emojiButton.contains(e.target) && !emojiPicker.contains(e.target)) {
        emojiPicker.classList.remove('show');
    }
});

// Socket event listeners
socket.on('user-connected', (data) => {
    currentUsername = data.username;
    currentUserColor = data.color;
    usernameDisplay.textContent = currentUsername;
    usernameDisplay.style.color = currentUserColor;
    addMessage(data, 'system');
});

socket.on('message-history', (messages) => {
    messages.forEach(msg => addMessage(msg));
});

socket.on('user-joined', (data) => {
    addMessage(data, 'system');
});

socket.on('user-left', (data) => {
    addMessage(data, 'system');
});

socket.on('chat-message', (data) => {
    addMessage(data);
});

socket.on('message-edited', (data) => {
    updateMessage(data);
});

socket.on('message-deleted', (messageId) => {
    removeMessage(messageId);
});

socket.on('favorites-update', (favorites) => {
    updateFavoritesDisplay(favorites);
});

socket.on('user-count', (count) => {
    userCountDisplay.textContent = count;
});

// Connection status
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    usernameDisplay.textContent = 'Disconnected';
    addMessage({ message: 'Connection lost. Trying to reconnect...' }, 'system');
});

// Initial setup
sendButton.disabled = true;