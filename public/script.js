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
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span style="color: ${isOwn ? 'rgba(255,255,255,0.8)' : data.color}; font-weight: 600;">
                    ${data.username}
                </span>
                <div class="message-actions">
                    <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-message-id="${data.id}">
                        <i class="${isFavorited ? 'fas' : 'far'} fa-heart"></i>
                    </button>
                    <span style="opacity: 0.6; font-size: 0.75rem;">${data.timestamp}</span>
                </div>
            </div>
            <div class="message-content">${escapeHtml(data.message)}</div>
        `;
        
        if (isOwn) {
            messageDiv.classList.add('own');
        }
    }
    
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Update favorites display
function updateFavoritesDisplay(favorites) {
    userFavorites = favorites.map(msg => msg.id);
    
    if (favorites.length === 0) {
        favoritesList.innerHTML = '<div class="no-favorites">No favorite messages yet</div>';
    } else {
        favoritesList.innerHTML = favorites.map(msg => `
            <div class="favorite-message" data-message-id="${msg.id}">
                <div class="message-header">
                    <span style="color: ${msg.color}; font-weight: 600;">
                        ${msg.username} • ${msg.timestamp}
                    </span>
                    <button class="remove-favorite-btn" data-message-id="${msg.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div>${escapeHtml(msg.message)}</div>
            </div>
        `).join('');
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

// Favorite button clicks in main chat
messagesContainer.addEventListener('click', (e) => {
    if (e.target.closest('.favorite-btn')) {
        const btn = e.target.closest('.favorite-btn');
        const messageId = parseInt(btn.dataset.messageId);
        socket.emit('toggle-favorite', messageId);
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