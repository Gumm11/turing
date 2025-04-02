-- Create conversations table
CREATE TABLE conversations (
    conversation_id SERIAL PRIMARY KEY,
    opponent_type BOOLEAN NOT NULL, -- true for AI, false for human
    time_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_guess BOOLEAN, -- true for AI guess, false for human guess, null if no guess made
    result BOOLEAN -- true if guess was correct, false if incorrect, null if no guess made
);

-- Create messages table
CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id INTEGER REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_role BOOLEAN NOT NULL, -- true for first player, false for second player
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_conversations_time_created ON conversations(time_created); 