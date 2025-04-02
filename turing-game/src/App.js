import React from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { createGlobalStyle } from 'styled-components';
import Matchmaking from './components/Matchmaking';
import Chat from './components/Chat';

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Archivo:wght@400;700&display=swap');
  
  body {
    margin: 0;
    padding: 0;
    font-family: 'Archivo', sans-serif;
    background-color: #101B23;
  }
`;

const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #101B23;
  overflow: hidden;
`;

const LandingContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  width: 100%;
  background: #101B23;
`;

const ImageSection = styled.div`
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  
  img {
    max-width: 100%;
    height: auto;
    object-fit: contain;
  }
`;

const ContentSection = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 2rem;
  text-align: center;
`;

const Title = styled.h1`
  font-size: 4rem;
  color: white;
  margin-bottom: 0.5rem;
  font-weight: 700;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

const Description = styled.p`
  font-size: 1.8rem;
  color: white;
  margin-bottom: 2rem;
  line-height: 1.6;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
`;

const StartButton = styled.button`
  padding: 1.2rem 3.5rem;
  font-size: 1.5rem;
  background: white;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 700;

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.98);
  }
`;

function LandingPage() {
  const navigate = useNavigate();

  return (
    <LandingContainer>
      <ImageSection>
        <img src="/component/landing.png" alt="Turing Game" />
      </ImageSection>
      <ContentSection>
        <Title>Turing Game</Title>
        <Description>
          Test your wit against AI or humans!
        </Description>
        <StartButton onClick={() => navigate('/matchmaking')}>
          Start Game
        </StartButton>
      </ContentSection>
    </LandingContainer>
  );
}

function App() {
  return (
    <Router>
      <GlobalStyle />
      <AppContainer>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/matchmaking" element={<Matchmaking />} />
          <Route path="/game" element={<Chat />} />
        </Routes>
      </AppContainer>
    </Router>
  );
}

export default App;
