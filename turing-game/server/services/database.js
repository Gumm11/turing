const db = require('../config/database');

class DatabaseService {
  // Conversation methods
  async createConversation(roomId, player1Id, player2Id, player1IsAI, player2IsAI) {
    const query = `
      INSERT INTO conversations (conversation_id, player1_id, player2_id, player1_is_ai, player2_is_ai)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING conversation_id, time_created
    `;
    const values = [roomId, player1Id, player2Id, player1IsAI, player2IsAI];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  }

  async getConversation(conversationId) {
    const query = `
      SELECT *
      FROM conversations
      WHERE conversation_id = $1
    `;
    const values = [conversationId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }

  async getConversationByRoomId(roomId) {
    const query = `
      SELECT *
      FROM conversations
      WHERE conversation_id = $1
    `;
    const values = [roomId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting conversation by room ID:', error);
      throw error;
    }
  }

  async getPlayerConversations(playerId) {
    const query = `
      SELECT *
      FROM conversations
      WHERE player1_id = $1 OR player2_id = $1
      ORDER BY time_created DESC
    `;
    const values = [playerId];
    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting player conversations:', error);
      throw error;
    }
  }

  async submitGuess(conversationId, playerId, isAIGuess) {
    console.log('Submitting guess:', { conversationId, playerId, isAIGuess });
    const query = `
      UPDATE conversations
      SET 
        player1_guess = CASE WHEN player1_id = $2 THEN $3 ELSE player1_guess END,
        player2_guess = CASE WHEN player2_id = $2 THEN $3 ELSE player2_guess END,
        player1_guess_correct = CASE 
          WHEN player1_id = $2 THEN ($3 = player2_is_ai)
          ELSE player1_guess_correct 
        END,
        player2_guess_correct = CASE 
          WHEN player2_id = $2 THEN ($3 = player1_is_ai)
          ELSE player2_guess_correct 
        END
      WHERE conversation_id = $1
      RETURNING 
        conversation_id,
        player1_id,
        player2_id,
        player1_is_ai,
        player2_is_ai,
        player1_guess,
        player2_guess,
        player1_guess_correct,
        player2_guess_correct
    `;
    const values = [conversationId, playerId, isAIGuess];
    try {
      const result = await db.query(query, values);
      console.log('Database result:', result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error('Error submitting guess:', error);
      throw error;
    }
  }

  // Message methods
  async createMessage(conversationId, senderRole, content, senderId) {
    const query = `
      INSERT INTO messages (conversation_id, sender_role, content, sender_id)
      VALUES ($1, $2, $3, $4)
      RETURNING message_id, sent_at
    `;
    const values = [conversationId, senderRole, content, senderId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  async getMessages(conversationId) {
    const query = `
      SELECT *
      FROM messages
      WHERE conversation_id = $1
      ORDER BY sent_at ASC
    `;
    const values = [conversationId];
    try {
      const result = await db.query(query, values);
      return result.rows;
    } catch (error) {
      console.error('Error getting messages:', error);
      throw error;
    }
  }

  async getConversationWithMessages(conversationId) {
    const query = `
      SELECT 
        c.*,
        json_agg(
          json_build_object(
            'message_id', m.message_id,
            'content', m.content,
            'sender_role', m.sender_role,
            'sent_at', m.sent_at,
            'sender_id', m.sender_id
          ) ORDER BY m.sent_at
        ) as messages
      FROM conversations c
      LEFT JOIN messages m ON c.conversation_id = m.conversation_id
      WHERE c.conversation_id = $1
      GROUP BY c.conversation_id
    `;
    const values = [conversationId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting conversation with messages:', error);
      throw error;
    }
  }

  async getOpponentTypes(conversationId) {
    const query = `
      SELECT 
        conversation_id,
        player1_id,
        player2_id,
        opponent_type as player1_opponent_type,
        NOT opponent_type as player2_opponent_type
      FROM conversations 
      WHERE conversation_id = $1
    `;
    const values = [conversationId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting opponent types:', error);
      throw error;
    }
  }

  async getPlayerOpponentType(conversationId, playerId) {
    const query = `
      SELECT 
        CASE 
          WHEN player1_id = $2 THEN opponent_type
          WHEN player2_id = $2 THEN NOT opponent_type
        END as opponent_type
      FROM conversations 
      WHERE conversation_id = $1
    `;
    const values = [conversationId, playerId];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error getting player opponent type:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService(); 