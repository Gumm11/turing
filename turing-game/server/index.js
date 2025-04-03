const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});
const dbService = require('./services/database');

// Store waiting players with their IDs
const waitingPlayers = new Map();

// Store active rooms and their players
const rooms = new Map();

// Constants for timers
const ROOM_TIME_LIMIT = 120000; // 2 minutes in milliseconds
const TURN_TIME_LIMIT = 900000;  // 15 minutes in milliseconds

// Add this at the top with other state variables
const roomTimers = new Map(); // Store room timers
const turnTimers = new Map(); // Store turn timers

// Add this at the top with other constants
const AI_RESPONSES = [
  "That's an interesting point!",
  "I see what you mean.",
  "Could you elaborate on that?",
  "I'm not sure I understand completely.",
  "That's a good question!",
  "Let me think about that...",
  "I have a different perspective on this.",
  "That's a fascinating observation.",
  "I agree with you on that.",
  "I'm not sure I agree with that point."
];

// Add this to track AI typing states
const aiTypingStates = new Map();

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  socket.on('JOIN_MATCHMAKING', () => {
    console.log(`Client ${socket.id} joined matchmaking`);
    handleMatchmaking(socket);
  });

  socket.on('CANCEL_MATCHMAKING', () => {
    console.log(`Client ${socket.id} cancelled matchmaking`);
    waitingPlayers.delete(socket.id);
    console.log(`Total waiting players:`, waitingPlayers.size);
  });

  socket.on('SEND_MESSAGE', async (data) => {
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      if (!room.isActive) return;

      const message = {
        text: data.text,
        timestamp: new Date().toISOString()
      };

      // Add message to room history
      room.messages.push(message);

      // Save message to database
      try {
        await dbService.createMessage(
          socket.roomId,
          room.players[0] === socket.id, // isPlayer1
          data.text,
          socket.id
        );
      } catch (error) {
        console.error('Error saving message:', error);
        socket.emit('ERROR', { message: 'Failed to save message' });
        return;
      }

      // Send message to sender (blue bubble)
      socket.emit('RECEIVE_MESSAGE', {
        ...message,
        isUser: true
      });

      // If this is a room with AI, handle AI response
      if (room.players.length === 1) {
        handleAIResponse(socket.roomId, socket.id);
      } else {
        // For human vs human, send to other player
        const otherPlayer = room.players.find(p => p !== socket.id);
        if (otherPlayer) {
          io.to(otherPlayer).emit('RECEIVE_MESSAGE', {
            ...message,
            isUser: false // This ensures the message appears as a gray bubble
          });

          // Notify other player it's their turn
          io.to(otherPlayer).emit('YOUR_TURN', {
            canSendMessage: true,
            timeLeft: TURN_TIME_LIMIT
          });

          // Start turn timer for other player
          startTurnCountdown(socket.roomId, otherPlayer);
        }
      }
    }
  });

  socket.on('TYPING_STATUS', (data) => {
    console.log(`Client ${socket.id} typing status:`, data);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      const otherPlayer = room.players.find(p => p !== socket.id);
      if (otherPlayer) {
        console.log(`Sending typing status to ${otherPlayer}`);
        io.to(otherPlayer).emit('OPPONENT_TYPING', { isTyping: data.isTyping });
      }
    }
  });

  socket.on('MAKE_GUESS', async (data) => {
    console.log(`Client ${socket.id} making guess:`, data);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      try {
        // Stop the room timer since a guess has been made
        if (roomTimers.has(socket.roomId)) {
          clearInterval(roomTimers.get(socket.roomId));
          roomTimers.delete(socket.roomId);
        }

        // Submit guess to database with player ID
        const result = await dbService.submitGuess(socket.roomId, socket.id, data.isAI);
        console.log('Guess result from database:', result);
        
        // Determine if the guess was correct
        const isCorrect = socket.id === result.player1_id ? 
          (data.isAI === result.player2_is_ai) : 
          (data.isAI === result.player1_is_ai);
        
        const actualType = socket.id === result.player1_id ? 
          (result.player2_is_ai ? 'AI' : 'Human') : 
          (result.player1_is_ai ? 'AI' : 'Human');

        console.log(`Sending guess result to ${socket.id}:`, {
          isCorrect,
          opponentGuess: data.isAI,
          actualType
        });

        // Send the result to the player who made the guess
        socket.emit('GUESS_RESULT', {
          isCorrect,
          opponentGuess: data.isAI,
          actualType,
          message: `Your guess was ${isCorrect ? 'correct' : 'incorrect'}! Your opponent was actually ${actualType}.`
        });

        // If both players have made their guesses, remove the room
        if (result.player1_guess !== null && result.player2_guess !== null) {
          setTimeout(() => {
            if (rooms.has(socket.roomId)) {
              rooms.delete(socket.roomId);
              console.log(`Room ${socket.roomId} removed after both players guessed`);
            }
          }, 5000);
        }
      } catch (error) {
        console.error('Error submitting guess:', error);
        socket.emit('ERROR', { message: 'Failed to submit guess' });
      }
    } else {
      console.error('Invalid room:', socket.roomId);
      socket.emit('ERROR', { message: 'Invalid room' });
    }
  });

  socket.on('RETIRE', () => {
    console.log(`Client ${socket.id} retiring`);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      const otherPlayer = room.players.find(p => p !== socket.id);
      
      if (otherPlayer) {
        console.log(`Notifying ${otherPlayer} that opponent retired`);
        // Notify other player that their opponent has retired
        io.to(otherPlayer).emit('OPPONENT_DISCONNECTED', { 
          message: 'Your opponent has retired from the game. You can now make your guess about your opponent.',
          canGuess: true
        });
        
        // Stop the room timer since the other player gets a chance to guess
        if (room.roomTimer) {
          clearTimeout(room.roomTimer);
          room.roomTimer = null;
        }
        
        // Allow the other player to make a guess
        io.to(otherPlayer).emit('YOUR_TURN', { 
          canSendMessage: false,
          canGuess: true
        });
      }
      
      // Notify the retiring player that they can't make a guess
      socket.emit('GAME_OVER', {
        message: 'You have retired from the game. You cannot make a guess.',
        canGuess: false
      });
      
      // Mark room as inactive
      room.isActive = false;
      
      // Remove room after cleanup
      setTimeout(() => {
        rooms.delete(socket.roomId);
        console.log(`Room ${socket.roomId} removed after retirement`);
      }, 5000);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Client ${socket.id} disconnected`);
    handleDisconnect(socket);
  });
});

const handleMatchmaking = async (socket) => {
  try {
    console.log('Player joined matchmaking:', socket.id);
    
    // Check if player is already in a room and if that room is still active
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room && room.isActive) {
        console.log(`Player ${socket.id} is already in active room ${socket.roomId}`);
        return;
      } else {
        // If room doesn't exist or is inactive, clear the roomId
        socket.roomId = null;
      }
    }

    // Check if player is already in waiting list
    if (waitingPlayers.has(socket.id)) {
      console.log(`Player ${socket.id} is already in matchmaking`);
      return;
    }

    // Add player to waiting list
    const isAI = Math.random() < 0.5; // 50% chance of being AI
    waitingPlayers.set(socket.id, {
      socket,
      isAI
    });

    console.log('Current waiting players:', waitingPlayers.size);

    // If player is assigned to AI, create room immediately
    if (isAI) {
      const roomId = generateRoomId();
      
      // Create conversation with AI
      const conversation = await dbService.createConversation(
        roomId,
        socket.id,
        'AI_OPPONENT',
        false, // player is human
        true   // opponent is AI
      );
      
      if (!conversation || !conversation.conversation_id) {
        throw new Error('Failed to create conversation with AI');
      }

      // Create room with player and AI
      rooms.set(roomId, {
        players: [socket.id],
        messages: [],
        isFirstTurn: true,
        playerTypes: new Map([[socket.id, false]]),
        isActive: true,
        startTime: Date.now(),
        currentTurn: null,
        turnTimer: null
      });

      // Set room ID and remove from waiting list
      socket.roomId = roomId;
      waitingPlayers.delete(socket.id);

      // Notify player about the room with AI
      socket.emit('MATCH_FOUND', {
        roomId,
        conversationId: conversation.conversation_id,
        isAI: true,
        isFirstTurn: true,
        timeLeft: ROOM_TIME_LIMIT
      });

      // Start room timer
      startRoomTimer(roomId);
    } else {
      // If player is assigned to human opponent, check for other waiting players
      if (waitingPlayers.size >= 2) {
        // Get the first two players from the waiting list
        const players = Array.from(waitingPlayers.values()).slice(0, 2);
        
        // Create a room for two human players
        const roomId = generateRoomId();
        
        // Create conversation in database
        const conversation = await dbService.createConversation(
          roomId,
          players[0].socket.id,
          players[1].socket.id,
          false, // player1 is human
          false  // player2 is human
        );
        
        if (!conversation || !conversation.conversation_id) {
          throw new Error('Failed to create conversation in database');
        }

        // Create room with both players
        rooms.set(roomId, {
          players: players.map(p => p.socket.id),
          messages: [],
          isFirstTurn: Math.random() < 0.5,
          playerTypes: new Map(players.map(p => [p.socket.id, false])),
          isActive: true,
          startTime: Date.now(),
          currentTurn: null,
          turnTimer: null
        });

        // Set room ID for both players and remove them from waiting list
        players.forEach(player => {
          player.socket.roomId = roomId;
          waitingPlayers.delete(player.socket.id);
        });

        // Notify both players about the room
        players.forEach((player, index) => {
          player.socket.emit('MATCH_FOUND', {
            roomId,
            conversationId: conversation.conversation_id,
            isAI: false,
            isFirstTurn: index === 0 ? rooms.get(roomId).isFirstTurn : !rooms.get(roomId).isFirstTurn,
            timeLeft: ROOM_TIME_LIMIT
          });
        });

        // Start room timer
        startRoomTimer(roomId);
      } else {
        // If not enough players, notify the player they are waiting
        socket.emit('WAITING_FOR_PLAYER', {
          message: 'Waiting for another player to join...'
        });
      }
    }
  } catch (error) {
    console.error('Error in handleMatchmaking:', error);
    socket.emit('ERROR', { message: 'Failed to join matchmaking' });
    waitingPlayers.delete(socket.id);
  }
};

const handleDisconnect = (socket) => {
  // Remove from waiting list if present
  waitingPlayers.delete(socket.id);
  
  // Handle room cleanup if client was in a room
  if (socket.roomId && rooms.has(socket.roomId)) {
    const room = rooms.get(socket.roomId);
    const otherPlayer = room.players.find(p => p !== socket.id);
    
    // Stop the room timer
    if (roomTimers.has(socket.roomId)) {
      clearInterval(roomTimers.get(socket.roomId));
      roomTimers.delete(socket.roomId);
    }
    
    // Clean up AI typing state
    if (aiTypingStates.has(socket.roomId)) {
      aiTypingStates.delete(socket.roomId);
    }
    
    if (otherPlayer) {
      // Notify other player that their opponent disconnected
      io.to(otherPlayer).emit('OPPONENT_DISCONNECTED', { 
        message: 'Your opponent has disconnected.',
        isAI: room.playerTypes.get(socket.id)
      });

      // Allow the other player to make a guess
      io.to(otherPlayer).emit('YOUR_TURN', { 
        canSendMessage: false,
        canGuess: true
      });
    }
    
    // Mark room as inactive
    room.isActive = false;
    
    // Remove room after cleanup
    setTimeout(() => {
      rooms.delete(socket.roomId);
      console.log(`Room ${socket.roomId} removed after cleanup`);
    }, 5000);
  }
  
  console.log('Remaining players:', waitingPlayers.size);
  console.log('Active rooms:', rooms.size);
};

const startRoomTimer = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Clear any existing timer
  if (room.roomTimer) {
    clearTimeout(room.roomTimer);
  }

  // Set new room timer
  room.roomTimer = setTimeout(() => {
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId);
      if (room.isActive) {
        // Time's up for the conversation
        room.isActive = false;
        
        // Notify all players in the room that conversation has ended
        room.players.forEach(playerId => {
          io.to(playerId).emit('CONVERSATION_ENDED', {
            message: "The conversation time has ended. You can now make your guess about your opponent.",
            canGuess: true
          });
        });

        // Set a timer to remove the room after 15 minutes
        setTimeout(() => {
          if (rooms.has(roomId)) {
            rooms.delete(roomId);
            console.log(`Room ${roomId} removed after 15 minutes of inactivity`);
          }
        }, 15 * 60 * 1000); // 15 minutes in milliseconds
      }
    }
  }, ROOM_TIME_LIMIT);

  // Start countdown updates
  let timeLeft = ROOM_TIME_LIMIT / 1000; // Convert to seconds
  const countdownInterval = setInterval(() => {
    if (!rooms.has(roomId)) {
      clearInterval(countdownInterval);
      return;
    }

    const room = rooms.get(roomId);
    if (!room.isActive) {
      clearInterval(countdownInterval);
      return;
    }

    timeLeft--;
    room.players.forEach(playerId => {
      io.to(playerId).emit('TIME_UPDATE', {
        timeLeft: timeLeft
      });
    });

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      // Send final 0 seconds update
      room.players.forEach(playerId => {
        io.to(playerId).emit('TIME_UPDATE', {
          timeLeft: 0
        });
      });
      // Trigger conversation ended immediately
      room.isActive = false;
      room.players.forEach(playerId => {
        io.to(playerId).emit('CONVERSATION_ENDED', {
          message: "The conversation time has ended. You can now make your guess about your opponent.",
          canGuess: true
        });
      });
    }
  }, 1000);
};

const startTurnCountdown = (roomId, playerId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Clear any existing timer for this player
  if (turnTimers.has(playerId)) {
    clearTimeout(turnTimers.get(playerId));
  }

  let timeLeft = TURN_TIME_LIMIT / 1000; // Convert to seconds
  const timer = setInterval(() => {
    timeLeft--;
    
    // Send time update to the player
    io.to(playerId).emit('TURN_TIME_UPDATE', {
      timeLeft,
      isLowTime: timeLeft <= 5
    });

    if (timeLeft <= 0) {
      clearInterval(timer);
      turnTimers.delete(playerId);
      
      // Time's up for this player's turn
      io.to(playerId).emit('TURN_TIME_UP');
      
      // Handle forfeit
      handleForfeit(roomId, playerId);
    }
  }, 1000);

  turnTimers.set(playerId, timer);
};

const handleForfeit = (roomId, playerId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Stop the room timer
  if (roomTimers.has(roomId)) {
    clearInterval(roomTimers.get(roomId));
    roomTimers.delete(roomId);
  }

  // Notify the player
  io.to(playerId).emit('FORFEIT_RESULT', {
    message: "You've lost your turn due to time running out."
  });

  // Notify other player
  const otherPlayer = room.players.find(p => p !== playerId);
  if (otherPlayer) {
    io.to(otherPlayer).emit('OPPONENT_FORFEIT');
  }
};

const generateRoomId = () => {
  return Math.random().toString(36).substring(7);
};

// Update the handleAIResponse function
const handleAIResponse = async (roomId, playerId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Random delay before starting to type (0.5-2 seconds)
  const startTypingDelay = Math.floor(Math.random() * 1500) + 500;
  
  setTimeout(() => {
    if (!rooms.has(roomId)) return;
    
    // Show typing indicator
    io.to(playerId).emit('OPPONENT_TYPING', { isTyping: true });
    aiTypingStates.set(roomId, true);

    // Random typing duration (2-5 seconds)
    const typingDuration = Math.floor(Math.random() * 3000) + 2000;
    
    setTimeout(async () => {
      if (!rooms.has(roomId)) return;

      const room = rooms.get(roomId);
      if (!room.isActive) return;

      // Get a random response
      const response = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
      
      // Create message object
      const message = {
        text: response,
        timestamp: new Date().toISOString()
      };

      // Add message to room history
      room.messages.push(message);

      // Save message to database
      try {
        await dbService.createMessage(
          roomId,
          false, // isPlayer1 (AI is always player2)
          response,
          'AI_OPPONENT'
        );
      } catch (error) {
        console.error('Error saving AI message:', error);
      }

      // Hide typing indicator
      io.to(playerId).emit('OPPONENT_TYPING', { isTyping: false });
      aiTypingStates.delete(roomId);

      // Send message to player
      io.to(playerId).emit('RECEIVE_MESSAGE', {
        ...message,
        isUser: false // This ensures the message appears as a gray bubble
      });

      // Random delay before allowing player to respond (0.5-1.5 seconds)
      const responseDelay = Math.floor(Math.random() * 1000) + 500;
      
      setTimeout(() => {
        if (!rooms.has(roomId)) return;
        
        // Notify player it's their turn
        io.to(playerId).emit('YOUR_TURN', {
          canSendMessage: true,
          timeLeft: TURN_TIME_LIMIT
        });

        // Start turn timer for player
        startTurnCountdown(roomId, playerId);
      }, responseDelay);
    }, typingDuration);
  }, startTypingDelay);
};

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 