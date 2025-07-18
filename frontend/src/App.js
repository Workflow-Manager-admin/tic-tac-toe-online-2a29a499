import React, { useState, useEffect } from 'react';
import './App.css';

const COLOR = {
  primary: '#1976D2',
  secondary: '#1565C0',
  accent: '#FFC107',
};

const PLAYER = {
  X: 'X',
  O: 'O',
};

// Simple AI for Tic Tac Toe (chooses random empty square)
function getRandomAiMove(board) {
  const empty = board
    .map((v, idx) => (v ? null : idx))
    .filter((v) => v !== null);
  if (empty.length === 0) return null;
  return empty[Math.floor(Math.random() * empty.length)];
}

// PUBLIC_INTERFACE
function calculateWinner(squares) {
  /** Returns 'X', 'O', or null for no winner yet */
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (let [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c])
      return squares[a];
  }
  return null;
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  const [board, setBoard] = useState(Array(9).fill(null));
  const [next, setNext] = useState(PLAYER.X); // Whose turn
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiFirst, setAiFirst] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  };

  // PUBLIC_INTERFACE
  const restart = (keepAi = false) => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setIsDraw(false);
    // If AI goes first, setNext to AI
    if (keepAi && aiEnabled && aiFirst) {
      setNext(PLAYER.O);
    } else {
      setNext(PLAYER.X);
    }
  };

  // AI move effect
  useEffect(() => {
    if (
      aiEnabled &&
      next === PLAYER.O &&
      !winner &&
      !isDraw &&
      board.filter((v) => !v).length > 0
    ) {
      const aiMove = getRandomAiMove(board);
      if (aiMove !== null) {
        // Add short delay for realism
        const handle = setTimeout(() => {
          handleSquareClick(aiMove);
        }, 400);
        return () => clearTimeout(handle);
      }
    }
    // eslint-disable-next-line
  }, [aiEnabled, next, winner, isDraw, board]);

  // Detect winner/draw
  useEffect(() => {
    const win = calculateWinner(board);
    if (win) {
      setWinner(win);
      setScores((prev) => ({ ...prev, [win]: prev[win] + 1 }));
    } else if (board.every((v) => v)) {
      setIsDraw(true);
    }
  }, [board]);

  // PUBLIC_INTERFACE
  const handleSquareClick = (idx) => {
    if (board[idx] || winner || isDraw) return;
    const newBoard = board.slice();
    newBoard[idx] = next;
    setBoard(newBoard);
    setNext(next === PLAYER.X ? PLAYER.O : PLAYER.X);
  };

  // PUBLIC_INTERFACE
  const handleModeChange = (mode) => {
    const enableAi = mode === 'ai';
    setAiEnabled(enableAi);
    setAiFirst(enableAi);
    setScores({ X: 0, O: 0 });
    // New game, AI as O can go first
    setBoard(Array(9).fill(null));
    setWinner(null);
    setIsDraw(false);
    setNext(enableAi ? PLAYER.O : PLAYER.X);
  };

  // UI helpers
  const statusMessage = () => {
    if (winner) return `Winner: ${winner}`;
    if (isDraw) return "It's a draw!";
    if (aiEnabled && next === PLAYER.O) return "AI's turn (O)";
    return `Next: ${next}`;
  };

  return (
    <div className="App tic-app-root">
      <header className="tic-header">
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
        <h1 className="tic-title">Tic Tac Toe</h1>
        <Scoreboard scores={scores} />
      </header>
      <main className="tic-main">
        <section className="tic-board-wrap">
          <GameBoard
            squares={board}
            onSquareClick={handleSquareClick}
            winner={winner}
            aiEnabled={aiEnabled}
            next={next}
            />
          <div className="tic-status" style={{ color: COLOR.secondary }}>{statusMessage()}</div>
        </section>
        <section className="tic-controls">
          <div className="tic-mode">
            <button
              className={`tic-btn${!aiEnabled ? ' active' : ''}`}
              style={{ background: !aiEnabled ? COLOR.primary : undefined }}
              onClick={() => handleModeChange('2p')}
              disabled={!aiEnabled}
              tabIndex="0"
            >2 Player</button>
            <button
              className={`tic-btn${aiEnabled ? ' active' : ''}`}
              style={{ background: aiEnabled ? COLOR.primary : undefined, marginLeft: 8 }}
              onClick={() => handleModeChange('ai')}
              disabled={aiEnabled}
              tabIndex="0"
            >Play vs AI</button>
          </div>
          <button className="tic-btn tic-restart-btn" onClick={() => restart(true)} style={{ background: COLOR.accent, color: '#212121' }}>
            Restart
          </button>
        </section>
      </main>
      <footer className="tic-footer">
        <span>
          <a href="https://reactjs.org/" target="_blank" rel="noopener noreferrer">React</a> Tic Tac Toe &middot; Minimal UI &middot; <span style={{ color: COLOR.accent, fontWeight: 600 }}>Light Theme</span>
        </span>
      </footer>
    </div>
  );
}

// PUBLIC_INTERFACE
function GameBoard({ squares, onSquareClick, winner, aiEnabled, next }) {
  /** Board drawing, highlights winning squares if applicable */
  return (
    <div className="tic-board">
      {squares.map((val, idx) => (
        <Square
          key={idx}
          value={val}
          highlight={false}
          onClick={() => onSquareClick(idx)}
          disabled={!!val || !!winner || (aiEnabled && next === PLAYER.O)}
        />
      ))}
    </div>
  );
}

// PUBLIC_INTERFACE
function Square({ value, onClick, highlight, disabled }) {
  /** Single square on the board */
  return (
    <button
      className={`tic-square${highlight ? ' highlight' : ''}`}
      onClick={onClick}
      disabled={disabled}
      tabIndex="0"
    >
      {value}
    </button>
  );
}

// PUBLIC_INTERFACE
function Scoreboard({ scores }) {
  /** Displays the score for X and O */
  return (
    <div className="tic-scoreboard">
      <span>
        <span className="tic-x" style={{ color: '#1565C0' }}>X:</span>
        <span className="tic-score">{scores.X}</span>
      </span>
      <span className="tic-divider">|</span>
      <span>
        <span className="tic-o" style={{ color: '#FFC107', fontWeight: 700 }}>O:</span>
        <span className="tic-score">{scores.O}</span>
      </span>
    </div>
  );
}

export default App;
