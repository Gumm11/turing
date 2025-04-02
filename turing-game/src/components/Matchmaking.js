import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { wsService } from '../services/websocket';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #1a1a1a;
  color: white;
`;

const Title = styled.h1`
  font-size: 2.5rem;
  margin-bottom: 2rem;
  color: #fff;
`;

const Status = styled.div`
  font-size: 1.5rem;
  margin-bottom: 2rem;
  color: #fff;
`;

const LoadingDots = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Dot = styled.div`
  width: 12px;
  height: 12px;
  background: #fff;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out;
  animation-delay: ${props => props.delay}s;

  @keyframes bounce {
    0%, 80%, 100% { 
      transform: scale(0);
      opacity: 0.3;
    }
    40% { 
      transform: scale(1);
      opacity: 1;
    }
  }
`;

const CancelButton = styled.button`
  padding: 0.8rem 2rem;
  font-size: 1.2rem;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
  margin-top: 2rem;

  &:hover {
    background: #cc0000;
  }
`;

function Matchmaking() {
  const [status, setStatus] = useState('Looking for opponent');
  const navigate = useNavigate();

  useEffect(() => {
    console.log('Matchmaking component mounted');
    
    // Only connect if not already connected
    if (!wsService.isConnected()) {
      console.log('Connecting to WebSocket server');
      wsService.connect();
    }

    const handleMatchFound = (data) => {
      console.log('Match found:', data);
      setStatus('Match found! Starting game...');
      // Navigate to game with match data
      navigate('/game', { 
        state: { 
          roomId: data.roomId,
          isAI: data.isAI,
          isFirstTurn: data.isFirstTurn
        }
      });
    };

    const handleError = (error) => {
      console.error('WebSocket error:', error);
      setStatus('Connection error. Please try again.');
    };

    // Add event listeners
    wsService.on('MATCH_FOUND', handleMatchFound);
    wsService.on('error', handleError);

    // Join matchmaking
    wsService.send('JOIN_MATCHMAKING');

    // Cleanup function
    return () => {
      console.log('Matchmaking component unmounting');
      // Remove event listeners but don't disconnect
      wsService.off('MATCH_FOUND', handleMatchFound);
      wsService.off('error', handleError);
    };
  }, [navigate]);

  const handleCancel = () => {
    console.log('Cancelling matchmaking');
    wsService.send('CANCEL_MATCHMAKING');
    navigate('/');
  };

  return (
    <Container>
      <Title>Matchmaking</Title>
      <Status>{status}</Status>
      <LoadingDots>
        <Dot delay={0} />
        <Dot delay={0.2} />
        <Dot delay={0.4} />
      </LoadingDots>
      <CancelButton onClick={handleCancel}>Cancel</CancelButton>
    </Container>
  );
}

export default Matchmaking;