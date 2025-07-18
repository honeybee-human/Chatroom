const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Color names for random user generation with matching hex colors
const colorData = [
  { name: 'Red', hex: '#e74c3c' },
  { name: 'Blue', hex: '#3498db' },
  { name: 'Green', hex: '#27ae60' },
  { name: 'Orange', hex: '#f39c12' },
  { name: 'Pink', hex: '#e91e63' },
  { name: 'Cyan', hex: '#1abc9c' },
  { name: 'Violet', hex: '#9b59b6' },
  { name: 'Gold', hex: '#f1c40f' },
  { name: 'Coral', hex: '#ff7675' },
  { name: 'Lime', hex: '#00b894' },
  { name: 'Indigo', hex: '#6c5ce7' },
  { name: 'Crimson', hex: '#d63031' },
  { name: 'Azure', hex: '#74b9ff' },
  { name: 'Emerald', hex: '#00cec9' },
  { name: 'Ruby', hex: '#fd79a8' },
  { name: 'Sapphire', hex: '#0984e3' }
];

// Store connected users and messages
const connectedUsers = new Map();
const messages = []; // Temporary message storage
const favoriteMessages = new Map(); // userId -> array of message IDs
let messageIdCounter = 1;

// Generate random color-based username
function generateUsername() {
  const colorInfo = colorData[Math.floor(Math.random() * colorData.length)];
  const number = Math.floor(Math.random() * 1000) + 1;
  return {
    name: `${colorInfo.name}${number}`,
    color: colorInfo.hex
  };
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // Generate username for new user
  const userInfo = generateUsername();
  connectedUsers.set(socket.id, userInfo);
  favoriteMessages.set(socket.id, []);
  
  // Send welcome message to user
  socket.emit('user-connected', {
    username: userInfo.name,
    color: userInfo.color,
    message: 'Welcome to the chatroom! 🎉'
  });
  
  // Send existing messages to new user
  socket.emit('message-history', messages);
  
  // Send user's favorites
  const userFavorites = favoriteMessages.get(socket.id) || [];
  const favoritedMessages = messages.filter(msg => userFavorites.includes(msg.id));
  socket.emit('favorites-update', favoritedMessages);
  
  // Broadcast to others that someone joined
  socket.broadcast.emit('user-joined', {
    username: userInfo.name,
    color: userInfo.color,
    message: `${userInfo.name} joined the chat 👋`
  });
  
  // Update user count
  io.emit('user-count', connectedUsers.size);
  
  // Handle incoming messages
  socket.on('chat-message', (data) => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      const message = {
        id: messageIdCounter++,
        username: userInfo.name,
        color: userInfo.color,
        message: data.message,
        timestamp: new Date().toLocaleTimeString(),
        userId: socket.id,
        edited: false,
        editedAt: null
      };
      
      // Store message
      messages.push(message);
      
      // Keep only last 100 messages
      if (messages.length > 100) {
        const removedMessage = messages.shift();
        // Remove from favorites if it was favorited
        favoriteMessages.forEach((favorites, userId) => {
          const index = favorites.indexOf(removedMessage.id);
          if (index !== -1) {
            favorites.splice(index, 1);
          }
        });
      }
      
      // Broadcast message to all users
      io.emit('chat-message', message);
    }
  });
  
  // Handle message editing
  socket.on('edit-message', (data) => {
    const messageIndex = messages.findIndex(msg => msg.id === data.messageId);
    if (messageIndex !== -1) {
      const message = messages[messageIndex];
      
      // Check if user owns the message
      if (message.userId === socket.id) {
        message.message = data.newMessage;
        message.edited = true;
        message.editedAt = new Date().toLocaleTimeString();
        
        // Broadcast updated message to all users
        io.emit('message-edited', message);
        
        // Update favorites if this message is favorited
        favoriteMessages.forEach((favorites, userId) => {
          if (favorites.includes(message.id)) {
            const favoritedMessages = messages.filter(msg => favorites.includes(msg.id));
            io.to(userId).emit('favorites-update', favoritedMessages);
          }
        });
      }
    }
  });
  
  // Handle message deletion
  socket.on('delete-message', (messageId) => {
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      const message = messages[messageIndex];
      
      // Check if user owns the message
      if (message.userId === socket.id) {
        // Remove from messages array
        messages.splice(messageIndex, 1);
        
        // Remove from all users' favorites
        favoriteMessages.forEach((favorites, userId) => {
          const index = favorites.indexOf(messageId);
          if (index !== -1) {
            favorites.splice(index, 1);
            const favoritedMessages = messages.filter(msg => favorites.includes(msg.id));
            io.to(userId).emit('favorites-update', favoritedMessages);
          }
        });
        
        // Broadcast deletion to all users
        io.emit('message-deleted', messageId);
      }
    }
  });
  
  // Handle message favoriting
  socket.on('toggle-favorite', (messageId) => {
    const userFavorites = favoriteMessages.get(socket.id) || [];
    const index = userFavorites.indexOf(messageId);
    
    if (index === -1) {
      userFavorites.push(messageId);
    } else {
      userFavorites.splice(index, 1);
    }
    
    favoriteMessages.set(socket.id, userFavorites);
    
    // Send updated favorites to user
    const favoritedMessages = messages.filter(msg => userFavorites.includes(msg.id));
    socket.emit('favorites-update', favoritedMessages);
  });
  
  // Handle user disconnect
  socket.on('disconnect', () => {
    const userInfo = connectedUsers.get(socket.id);
    if (userInfo) {
      connectedUsers.delete(socket.id);
      favoriteMessages.delete(socket.id);
      
      // Broadcast that user left
      socket.broadcast.emit('user-left', {
        username: userInfo.name,
        color: userInfo.color,
        message: `${userInfo.name} left the chat 👋`
      });
      
      // Update user count
      io.emit('user-count', connectedUsers.size);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Chatroom server running on http://localhost:${PORT}`);
});