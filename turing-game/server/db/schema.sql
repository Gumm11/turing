-- Drop existing tables if they exist
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    conversation_id TEXT PRIMARY KEY, -- This will store the room_id
    time_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    player1_id TEXT NOT NULL,
    player2_id TEXT NOT NULL,
    player1_is_ai BOOLEAN NOT NULL, -- true if player1 is AI
    player2_is_ai BOOLEAN NOT NULL, -- true if player2 is AI
    player1_guess BOOLEAN, -- player1's guess: false for AI, true for human
    player2_guess BOOLEAN, -- player2's guess: false for AI, true for human
    player1_guess_correct BOOLEAN, -- whether player1's guess was correct
    player2_guess_correct BOOLEAN  -- whether player2's guess was correct
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    message_id SERIAL PRIMARY KEY,
    conversation_id TEXT REFERENCES conversations(conversation_id),
    sender_role BOOLEAN NOT NULL, -- false for AI/opponent, true for user
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content TEXT NOT NULL,
    sender_id TEXT NOT NULL -- socket ID of the sender
); 