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
    console.log(`Client ${socket.id} sending message:`, data);
    if (socket.roomId && rooms.has(socket.roomId)) {
      const room = rooms.get(socket.roomId);
      const sender = room.players.find(p => p === socket.id);
      const otherPlayer = room.players.find(p => p !== socket.id);
      
      if (sender && otherPlayer) {
        try {
          // Determine if sender is player1 (true) or player2 (false)
          const isPlayer1 = room.players[0] === socket.id;
          
          // Save message to database with sender_id and correct role
          await dbService.createMessage(
            socket.roomId,
            isPlayer1, // true for player1, false for player2
            data.text,
            socket.id
          );

          // Create the message object
          const message = {
            text: data.text,
            timestamp: new Date().toISOString()
          };
          
          // Add message to room history
          room.messages.push(message);
          
          console.log(`Sending message to sender ${socket.id}`);
          // Send to sender (blue bubble)
          socket.emit('RECEIVE_MESSAGE', {
            ...message,
            isUser: true
          });
          
          console.log(`Sending message to receiver ${otherPlayer}`);
          // Send to receiver (gray bubble)
          io.to(otherPlayer).emit('RECEIVE_MESSAGE', {
            ...message,
            isUser: false
          });

          console.log(`Notifying ${otherPlayer} that it's their turn`);
          // Notify receiver that it's their turn
          io.to(otherPlayer).emit('YOUR_TURN', { 
            canSendMessage: true,
            timeLeft: TURN_TIME_LIMIT
          });

          // Start turn timer for receiver
          startTurnCountdown(socket.roomId, otherPlayer);
        } catch (error) {
          console.error('Error saving message:', error);
          socket.emit('ERROR', { message: 'Failed to send message' });
        }
      } else {
        console.error('Invalid sender or receiver:', { sender, otherPlayer });
        socket.emit('ERROR', { message: 'Invalid sender or receiver' });
      }
    } else {
      console.error('Invalid room:', socket.roomId);
      socket.emit('ERROR', { message: 'Invalid room' });
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
        
        console.log(`Sending guess result to ${socket.id}:`, {
          isCorrect,
          opponentGuess: data.isAI,
          actualType: socket.id === result.player1_id ? 
            (result.player2_is_ai ? 'AI' : 'Human') : 
            (result.player1_is_ai ? 'AI' : 'Human')
        });

        // Send the result to the player who made the guess
        socket.emit('GUESS_RESULT', {
          isCorrect,
          opponentGuess: data.isAI,
          actualType: socket.id === result.player1_id ? 
            (result.player2_is_ai ? 'AI' : 'Human') : 
            (result.player1_is_ai ? 'AI' : 'Human')
        });

        // If there's another player, notify them that the game is over
        const otherPlayer = room.players.find(p => p !== socket.id);
        if (otherPlayer) {
          console.log(`Notifying ${otherPlayer} that game is over`);
          io.to(otherPlayer).emit('GAME_OVER', {
            message: 'Your opponent has made their guess. The game is over.'
          });
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
          message: 'Your opponent has retired from the game.',
          isAI: room.playerTypes.get(socket.id) // Send whether the retired player was an AI
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
    
    // Check if player is already in a room
    if (socket.roomId && rooms.has(socket.roomId)) {
      console.log(`Player ${socket.id} is already in room ${socket.roomId}`);
      return;
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

    // If we have at least 2 players waiting, create a room
    if (waitingPlayers.size >= 2) {
      // Get only the first two players from the waiting list
      const players = Array.from(waitingPlayers.values()).slice(0, 2);
      const roomId = generateRoomId();
      
      // Create conversation in database with player IDs
      console.log('Creating conversation in database:', {
        opponentType: players[1].isAI,
        player1: players[0].socket.id,
        player2: players[1].socket.id,
        roomId
      });

      const conversation = await dbService.createConversation(
        roomId,
        players[0].socket.id,
        players[1].socket.id,
        players[0].isAI,
        players[1].isAI
      );
      
      if (!conversation || !conversation.conversation_id) {
        throw new Error('Failed to create conversation in database');
      }

      console.log('Created conversation:', conversation);
      
      // Create room with just these two players
      rooms.set(roomId, {
        players: players.map(p => p.socket.id),
        messages: [],
        isFirstTurn: Math.random() < 0.5, // Randomly decide who goes first
        playerTypes: new Map(players.map(p => [p.socket.id, p.isAI])), // Store AI status for each player
        isActive: true, // Track room status
        startTime: Date.now(), // Track when room was created
        currentTurn: null, // Track whose turn it is
        turnTimer: null // Store turn timer reference
      });

      // Set room ID for just these two players and remove them from waiting list
      players.forEach(player => {
        player.socket.roomId = roomId;
        waitingPlayers.delete(player.socket.id);
      });

      // Notify just these two players about the room
      players.forEach((player, index) => {
        player.socket.emit('MATCH_FOUND', {
          roomId,
          conversationId: conversation.conversation_id,
          isAI: player.isAI,
          isFirstTurn: index === 0 ? rooms.get(roomId).isFirstTurn : !rooms.get(roomId).isFirstTurn,
          timeLeft: ROOM_TIME_LIMIT
        });
      });

      // Start room timer
      startRoomCountdown(roomId);

      console.log(`Created room ${roomId} with conversation_id ${conversation.conversation_id}`);
      console.log('Remaining players in waiting list:', waitingPlayers.size);
    } else {
      // If not enough players, notify the player they are waiting
      socket.emit('WAITING_FOR_PLAYER', {
        message: 'Waiting for another player to join...'
      });
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

const startRoomCountdown = (roomId) => {
  const room = rooms.get(roomId);
  if (!room) return;

  // Clear any existing timer
  if (roomTimers.has(roomId)) {
    clearInterval(roomTimers.get(roomId));
  }

  let timeLeft = ROOM_TIME_LIMIT / 1000; // Convert to seconds
  const timer = setInterval(() => {
    // Check if room is still active
    if (!room.isActive) {
      clearInterval(timer);
      roomTimers.delete(roomId);
      return;
    }

    timeLeft--;
    
    // Broadcast time update to all players in the room
    room.players.forEach(playerId => {
      io.to(playerId).emit('TIME_UPDATE', {
        timeLeft,
        isLowTime: timeLeft <= 30
      });
    });

    if (timeLeft <= 0) {
      clearInterval(timer);
      roomTimers.delete(roomId);
      
      // Time's up - notify all players
      room.players.forEach(playerId => {
        io.to(playerId).emit('ROOM_TIME_UP', {
          message: "Time's up! Make your guess about your opponent."
        });
      });

      // Mark room as inactive
      room.isActive = false;
      
      // Remove room after cleanup
      setTimeout(() => {
        rooms.delete(roomId);
        console.log(`Room ${roomId} removed after time up`);
      }, 5000);
    }
  }, 1000);

  roomTimers.set(roomId, timer);
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

const PORT = process.env.PORT || 8080;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 