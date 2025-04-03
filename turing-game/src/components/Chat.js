import React, { useState, useEffect, useRef } from 'react';
import styled, { keyframes } from 'styled-components';
import { useNavigate, useLocation } from 'react-router-dom';
import { wsService } from '../services/websocket';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const typing = keyframes`
  0% { transform: translateY(0px); }
  28% { transform: translateY(-5px); }
  44% { transform: translateY(0px); }
`;

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
`;

const ChatContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #101B23;
  color: white;
  width: 100%;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const ChatWrapper = styled.div`
  width: 100%;
  max-width: 800px;
  height: 90vh;
  background: #101B23;
  position: relative;
  display: flex;
  flex-direction: column;
  margin: 0 auto;
`;

const Header = styled.div`
  padding: 1.5rem;
  text-align: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: #101B23;
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const RetireButton = styled.button`
  padding: 0.5rem 1.5rem;
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 1.5rem;
  background: rgba(255, 107, 107, 0.1);
  color: #ff6b6b;
  font-size: 1.2rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(255, 107, 107, 0.2);
    transform: scale(1.05);
  }
`;

const Title = styled.h1`
  font-size: 2rem;
  margin: 0;
  font-weight: 700;
`;

const Timer = styled.div`
  font-size: 1.8rem;
  font-weight: 700;
  color: ${props => props.isLowTime ? '#ff6b6b' : '#fff'};
  background: ${props => props.isLowTime ? 'rgba(255, 107, 107, 0.2)' : 'rgba(255, 255, 255, 0.1)'};
  padding: 0.5rem 1.5rem;
  border-radius: 1.5rem;
  border: 1px solid ${props => props.isLowTime ? 'rgba(255, 107, 107, 0.3)' : 'rgba(255, 255, 255, 0.2)'};
  box-shadow: ${props => props.isLowTime ? '0 0 10px rgba(255, 107, 107, 0.1)' : 'none'};
  animation: ${props => props.isLowTime ? pulse : 'none'} 1s infinite;
`;

const ChatArea = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  padding-bottom: 100px;
`;

const MessageBubble = styled.div`
  max-width: 85%;
  padding: 1rem 1.2rem;
  border-radius: 1.2rem;
  font-size: 1.2rem;
  line-height: 1.5;
  animation: ${fadeIn} 0.3s ease-out;
  ${props => props.isUser ? `
    background: #007bff;
    align-self: flex-end;
    border-bottom-right-radius: 0.3rem;
  ` : `
    background: #2a2a2a;
    align-self: flex-start;
    border-bottom-left-radius: 0.3rem;
  `}
`;

const InputContainer = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.5rem;
  background: #101B23;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 1rem;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 0.8rem 1.2rem;
  border: none;
  border-radius: 1.5rem;
  background: #2a2a2a;
  color: white;
  font-size: 1.1rem;

  &:focus {
    outline: none;
  }

  &::placeholder {
    color: #888;
  }
`;

const SendButton = styled.button`
  padding: 0.8rem 1.5rem;
  border: none;
  border-radius: 1.5rem;
  background: #007bff;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 1.1rem;
  font-weight: 600;

  &:hover {
    transform: scale(1.05);
    background: #0056b3;
  }
`;

const TypingIndicator = styled.div`
  display: flex;
  gap: 0.3rem;
  padding: 0.6rem 1rem;
  background: #2a2a2a;
  border-radius: 1rem;
  align-self: flex-start;
  margin-bottom: 0.5rem;
  animation: ${fadeIn} 0.3s ease-out;
`;

const TypingDot = styled.div`
  width: 8px;
  height: 8px;
  background: #888;
  border-radius: 50%;
  animation: ${typing} 1.4s infinite;
  animation-delay: ${props => props.delay}s;
`;

const PopupOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  animation: ${fadeIn} 0.3s ease-out;
  z-index: 100;
`;

const PopupContent = styled.div`
  background: #1a2b3c;
  padding: 2rem;
  border-radius: 1.5rem;
  text-align: center;
  max-width: 90%;
  width: 320px;
`;

const PopupTitle = styled.h2`
  font-size: 1.8rem;
  margin-bottom: 1.2rem;
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-top: 1.5rem;
`;

const GuessButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  background: ${props => props.isAI ? '#ff6b6b' : '#4CAF50'};
  color: white;
  font-weight: 600;

  &:hover {
    transform: scale(1.05);
    background: ${props => props.isAI ? '#ff5252' : '#45a049'};
  }
`;

const PlayAgainButton = styled.button`
  padding: 0.8rem 1.5rem;
  font-size: 1.2rem;
  border: none;
  border-radius: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #007bff;
  color: white;
  font-weight: 600;
  width: 100%;

  &:hover {
    transform: scale(1.05);
    background: #0056b3;
  }
`;

const TurnTimer = styled.div`
  font-size: 1.2rem;
  font-weight: 600;
  color: ${props => props.isLowTime ? '#ff6b6b' : '#888'};
  margin-top: 0.5rem;
  text-align: center;
  animation: ${props => props.isLowTime ? pulse : 'none'} 1s infinite;
`;

const TurnNotification = styled.div`
  background: rgba(0, 123, 255, 0.1);
  color: #007bff;
  padding: 0.8rem 1.5rem;
  border-radius: 1rem;
  text-align: center;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  border: 1px solid rgba(0, 123, 255, 0.2);
  animation: ${fadeIn} 0.3s ease-out;
`;

const OpponentStatus = styled.div`
  color: #888;
  font-size: 1rem;
  text-align: center;
  margin-top: 0.5rem;
  font-style: italic;
`;

function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomId, isAI, isFirstTurn } = location.state || {};
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [canSendMessage, setCanSendMessage] = useState(isFirstTurn);
  const [timeLeft, setTimeLeft] = useState(120);
  const [showPopup, setShowPopup] = useState(false);
  const [canGuess, setCanGuess] = useState(true);
  const [turnTimeLeft, setTurnTimeLeft] = useState(15);
  const [isTyping, setIsTyping] = useState(false);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [isOpponentDisconnected, setIsOpponentDisconnected] = useState(false);
  const [guessResult, setGuessResult] = useState(null);
  const chatAreaRef = useRef(null);
  const [showRetireConfirm, setShowRetireConfirm] = useState(false);
  const [popupTitle, setPopupTitle] = useState('');
  const [popupMessage, setPopupMessage] = useState('');

  useEffect(() => {
    console.log('Chat component mounted with state:', { roomId, isAI, isFirstTurn });
    
    if (!roomId) {
      console.error('No room ID provided');
      return;
    }

    // Ensure WebSocket is connected
    if (!wsService.isConnected()) {
      console.log('Connecting to WebSocket...');
      wsService.connect();
    }

    const handleReceiveMessage = (message) => {
      console.log('Received message in Chat component:', {
        message,
        currentMessages: messages,
        roomId,
        isUser: message.isUser
      });
      
      if (!message || !message.text) {
        console.error('Invalid message received:', message);
        return;
      }
      
      // Check if this message is already in the messages array
      const isDuplicate = messages.some(m => 
        m.text === message.text && 
        m.timestamp === message.timestamp
      );
      
      if (!isDuplicate) {
        console.log('Adding new message to state:', {
          text: message.text,
          isUser: message.isUser,
          timestamp: message.timestamp
        });
        
        setMessages(prev => [...prev, {
          text: message.text,
          isUser: message.isUser,
          timestamp: message.timestamp
        }]);
      } else {
        console.log('Skipping duplicate message');
      }
      
      setIsOpponentTyping(false);
    };

    const handleOpponentTyping = (data) => {
      console.log('Opponent typing status:', data);
      setIsOpponentTyping(data.isTyping);
    };

    const handleOpponentDisconnected = (data) => {
      console.log('Opponent disconnected:', data);
      setIsOpponentDisconnected(true);
      setCanGuess(data.canGuess);
      setShowPopup(true);
      setPopupTitle("Opponent Left");
      setPopupMessage(data.message);
    };

    const handleGuessResult = (data) => {
      console.log('Received guess result:', data);
      setCanGuess(false);
      setCanSendMessage(false);
      setShowPopup(true);
      setPopupTitle("Guess Result!");
      setPopupMessage(data.message);
    };

    const handleGameOver = (data) => {
      console.log('Game over:', data);
      setCanSendMessage(false);
      setCanGuess(data.canGuess);
      setShowPopup(true);
      setPopupTitle("Game Over");
      setPopupMessage(data.message);
    };

    const handleYourTurn = (data) => {
      console.log('Received turn notification:', data);
      setCanSendMessage(data.canSendMessage);
      setTurnTimeLeft(15);
    };

    const handleTimeUpdate = (data) => {
      console.log('Received time update:', data);
      setTimeLeft(data.timeLeft);
    };

    const handleConversationEnded = (data) => {
      console.log('Conversation ended:', data);
      setCanSendMessage(false);
      setCanGuess(true);
      setShowPopup(true);
      setPopupTitle("Conversation Ended");
      setPopupMessage(data.message);
    };

    const handleTurnTimeUpdate = (data) => {
      console.log('Received turn time update:', data);
      setTurnTimeLeft(data.timeLeft);
    };

    const handleTurnTimeUp = () => {
      console.log('Turn time up');
      handleForfeit();
    };

    const handleOpponentForfeit = () => {
      console.log('Opponent forfeited');
      setCanGuess(true);
      setShowPopup(true);
    };

    // Add WebSocket event listeners
    wsService.on('RECEIVE_MESSAGE', handleReceiveMessage);
    wsService.on('OPPONENT_TYPING', handleOpponentTyping);
    wsService.on('OPPONENT_DISCONNECTED', handleOpponentDisconnected);
    wsService.on('YOUR_TURN', handleYourTurn);
    wsService.on('GUESS_RESULT', handleGuessResult);
    wsService.on('GAME_OVER', handleGameOver);
    wsService.on('TIME_UPDATE', handleTimeUpdate);
    wsService.on('CONVERSATION_ENDED', handleConversationEnded);
    wsService.on('TURN_TIME_UPDATE', handleTurnTimeUpdate);
    wsService.on('TURN_TIME_UP', handleTurnTimeUp);
    wsService.on('OPPONENT_FORFEIT', handleOpponentForfeit);

    // Cleanup function
    return () => {
      console.log('Chat component unmounting');
      wsService.off('RECEIVE_MESSAGE', handleReceiveMessage);
      wsService.off('OPPONENT_TYPING', handleOpponentTyping);
      wsService.off('OPPONENT_DISCONNECTED', handleOpponentDisconnected);
      wsService.off('YOUR_TURN', handleYourTurn);
      wsService.off('GUESS_RESULT', handleGuessResult);
      wsService.off('GAME_OVER', handleGameOver);
      wsService.off('TIME_UPDATE', handleTimeUpdate);
      wsService.off('CONVERSATION_ENDED', handleConversationEnded);
      wsService.off('TURN_TIME_UPDATE', handleTurnTimeUpdate);
      wsService.off('TURN_TIME_UP', handleTurnTimeUp);
      wsService.off('OPPONENT_FORFEIT', handleOpponentForfeit);
    };
  }, [roomId, isAI, isFirstTurn]);

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Add typing indicator effect
  useEffect(() => {
    let typingTimeout;
    if (inputMessage.trim()) {
      setIsTyping(true);
      wsService.send('TYPING_STATUS', { isTyping: true });

      typingTimeout = setTimeout(() => {
        setIsTyping(false);
        wsService.send('TYPING_STATUS', { isTyping: false });
      }, 1000);
    } else {
      setIsTyping(false);
      wsService.send('TYPING_STATUS', { isTyping: false });
    }

    return () => {
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
    };
  }, [inputMessage]);

  // Add effect to monitor guessResult changes
  useEffect(() => {
    console.log('guessResult state changed:', guessResult);
  }, [guessResult]);

  // Add effect to monitor showPopup changes
  useEffect(() => {
    console.log('showPopup state changed:', showPopup);
  }, [showPopup]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleForfeit = () => {
    wsService.send('FORFEIT', { roomId });
    setCanSendMessage(false);
    setCanGuess(false);
    setShowPopup(true);
  };

  const handleRetire = () => {
    setShowRetireConfirm(true);
  };

  const confirmRetire = () => {
    wsService.send('RETIRE');
    setCanSendMessage(false);
    setCanGuess(false);
    setShowPopup(true);
    setShowRetireConfirm(false);
  };

  const cancelRetire = () => {
    setShowRetireConfirm(false);
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !canSendMessage) return;

    const messageText = inputMessage.trim();
    console.log('Sending message from Chat component:', {
      text: messageText,
      isUser: true,
      timestamp: new Date().toISOString(),
      roomId
    });

    // Send message through WebSocket
    wsService.send('SEND_MESSAGE', {
      text: messageText
    });

    setInputMessage('');
    setCanSendMessage(false);
    setIsTyping(false);
  };

  const handleGuess = (isAI) => {
    if (!canGuess) {
      console.log('Cannot guess - canGuess is false');
      return;
    }
    console.log('Sending guess:', { roomId, isAI });
    wsService.send('MAKE_GUESS', { roomId, isAI });
    setCanGuess(false);
    setCanSendMessage(false);
  };

  const handlePlayAgain = () => {
    navigate('/matchmaking');
  };

  return (
    <ChatContainer>
      <ChatWrapper>
        <Header>
          <RetireButton onClick={handleRetire}>Retire</RetireButton>
          <Title>Turing Game</Title>
          <Timer isLowTime={timeLeft <= 30}>{formatTime(timeLeft)}</Timer>
        </Header>

        <ChatArea ref={chatAreaRef}>
          {isFirstTurn && (
            <TurnNotification>
              You go first! Start the conversation.
            </TurnNotification>
          )}
          {messages.map((message, index) => (
            <MessageBubble key={index} isUser={message.isUser}>
              {message.text}
            </MessageBubble>
          ))}
          {isOpponentTyping && (
            <TypingIndicator>
              <TypingDot delay={0} />
              <TypingDot delay={0.2} />
              <TypingDot delay={0.4} />
            </TypingIndicator>
          )}
        </ChatArea>

        <form onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}>
          <InputContainer>
            <MessageInput
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                canSendMessage 
                  ? "Type your message..." 
                  : isFirstTurn 
                    ? "Waiting for opponent to join..." 
                    : "Waiting for opponent's turn..."
              }
              disabled={!canSendMessage}
            />
            <SendButton type="submit" disabled={!canSendMessage}>
              Send
            </SendButton>
          </InputContainer>
          {canSendMessage && (
            <TurnTimer isLowTime={turnTimeLeft <= 5}>
              Your turn: {turnTimeLeft}s
            </TurnTimer>
          )}
          {!canSendMessage && !isFirstTurn && (
            <OpponentStatus>
              Waiting for opponent to send their message...
            </OpponentStatus>
          )}
        </form>

        {showRetireConfirm && (
          <PopupOverlay>
            <PopupContent>
              <PopupTitle>Confirm Retirement</PopupTitle>
              <p style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                Are you sure you want to retire? You will lose your chance to guess whether your opponent is an AI or human.
              </p>
              <ButtonGroup>
                <PlayAgainButton onClick={confirmRetire} style={{ background: '#ff6b6b' }}>
                  Yes
                </PlayAgainButton>
                <PlayAgainButton onClick={cancelRetire} style={{ background: '#4CAF50' }}>
                  No
                </PlayAgainButton>
              </ButtonGroup>
            </PopupContent>
          </PopupOverlay>
        )}

        {showPopup && !showRetireConfirm && (
          <PopupOverlay>
            <PopupContent>
              <PopupTitle>{popupTitle}</PopupTitle>
              <p style={{ marginBottom: '1.2rem', fontSize: '1.1rem' }}>
                {popupMessage}
              </p>
              {canGuess && (
                <ButtonGroup>
                  <GuessButton isAI onClick={() => handleGuess(false)}>Human</GuessButton>
                  <GuessButton isAI={false} onClick={() => handleGuess(true)}>AI</GuessButton>
                </ButtonGroup>
              )}
              {!canGuess && (
                <ButtonGroup>
                  <PlayAgainButton onClick={handlePlayAgain}>Play Again</PlayAgainButton>
                </ButtonGroup>
              )}
            </PopupContent>
          </PopupOverlay>
        )}
      </ChatWrapper>
    </ChatContainer>
  );
}

export default Chat; 