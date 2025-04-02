const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'turing_game',
  password: process.env.DB_PASSWORD || 'postgres',
  port: process.env.DB_PORT || 5432,
});

// Conversations
async function createConversation(opponentType) {
  const result = await pool.query(
    'INSERT INTO conversations (opponent_type) VALUES ($1) RETURNING conversation_id',
    [opponentType]
  );
  return result.rows[0].conversation_id;
}

async function updateConversationGuess(conversationId, userGuess, result) {
  await pool.query(
    'UPDATE conversations SET user_guess = $1, result = $2 WHERE conversation_id = $3',
    [userGuess, result, conversationId]
  );
}

async function getConversation(conversationId) {
  const result = await pool.query(
    'SELECT * FROM conversations WHERE conversation_id = $1',
    [conversationId]
  );
  return result.rows[0];
}

// Messages
async function createMessage(conversationId, senderRole, content) {
  const result = await pool.query(
    'INSERT INTO messages (conversation_id, sender_role, content) VALUES ($1, $2, $3) RETURNING message_id',
    [conversationId, senderRole, content]
  );
  return result.rows[0].message_id;
}

async function getConversationMessages(conversationId) {
  const result = await pool.query(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY sent_at ASC',
    [conversationId]
  );
  return result.rows;
}

// Statistics
async function getGameStatistics() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_games,
      SUM(CASE WHEN result = true THEN 1 ELSE 0 END) as correct_guesses,
      SUM(CASE WHEN opponent_type = true THEN 1 ELSE 0 END) as ai_opponents,
      SUM(CASE WHEN opponent_type = false THEN 1 ELSE 0 END) as human_opponents
    FROM conversations 
    WHERE user_guess IS NOT NULL
  `);
  return result.rows[0];
}

module.exports = {
  createConversation,
  updateConversationGuess,
  getConversation,
  createMessage,
  getConversationMessages,
  getGameStatistics
}; 