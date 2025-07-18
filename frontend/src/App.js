import React, { useState, useEffect } from 'react';
import './App.css';

/*
  ===== OpenAI Integration Notes =====
  - The OpenAI API key MUST be set as REACT_APP_OPENAI_API_KEY in your .env file.
    Example: REACT_APP_OPENAI_API_KEY=sk-xxxxxx
  - Never hardcode the API key into your application.
  - This React app calls OpenAI's API directly via fetch.
  - See README for additional config and environment info.
*/

// PUBLIC_INTERFACE
const COLOR = {
  primary: '#1976D2',
  secondary: '#1565C0',
  accent: '#FFC107',
};

const PLAYER = {
  X: 'X',
  O: 'O',
};
const GAME_MODE = {
  HUMAN: '2p',
  AI: 'ai',
};

// Simple random-move fallback if OpenAI API fails
function getRandomAiMove(board) {
  const empty = board.map((v, idx) => (v ? null : idx)).filter((v) => v !== null);
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

/**
 * Gets the AI's move from OpenAI GPT
 * Returns the chosen index (0-8) or null if error.
 * Uses the REACT_APP_OPENAI_API_KEY env variable for authentication.
 */
async function getOpenAIMove(board, aiSymbol) {
  const key = process.env.REACT_APP_OPENAI_API_KEY;
  if (!key) {
    throw new Error("Missing OpenAI API Key. Please set REACT_APP_OPENAI_API_KEY in your .env file.");
  }
  // Human-readable board: Cells 0-8 (row-major)
  // Prompt instructs AI to output ONE number: the index to fill
  const prompt = `
You are playing Tic Tac Toe as ${aiSymbol}. The board is a 1D array with indices 0-8, left-to-right, top to bottom.
Current board: [${board.map(v => v ? v : " ").join(", ")}]
Pick an unfilled cell for your move and respond ONLY with the number (no other words). Valid moves: [${board.map((v, idx) => v ? null : idx).filter(v => v !== null).join(", ")}]
Respond:`;

  // Only one completion to make parsing reliable
  const body = {
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "You are a Tic Tac Toe AI. Only output a single number 0-8 when asked for your move." },
      { role: "user", content: prompt }
    ],
    max_tokens: 3,
    temperature: 0,
  };

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let txt = await res.text();
      throw new Error(`OpenAI error: ${res.status} ${txt}`);
    }
    const data = await res.json();
    let idx = null;
    // Robustly try to find a cell number in the response
    const content = (
      data?.choices?.[0]?.message?.content ||
      data?.choices?.[0]?.text ||
      ""
    )
      .replace(/[^\d]/g, "")
      .slice(0, 1); // Pick the first digit only
    idx = parseInt(content, 10);
    const validMoves = board
      .map((v, i) => (v ? null : i))
      .filter((x) => x !== null);
    if (!isNaN(idx) && validMoves.includes(idx)) {
      return idx;
    }
    // fallback to random move
    return getRandomAiMove(board);
  } catch (e) {
    // fallback to random move on any failure
    // Optionally, you may want to bubble this up to show error state in UI
    return getRandomAiMove(board);
  }
}

// PUBLIC_INTERFACE
function App() {
  const [theme, setTheme] = useState('light');
  const [board, setBoard] = useState(Array(9).fill(null));
  const [next, setNext] = useState(PLAYER.X); // Whose turn
  const [winner, setWinner] = useState(null);
  const [isDraw, setIsDraw] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  // AI-related state
  const [mode, setMode] = useState(GAME_MODE.HUMAN);
  const [aiFirst, setAiFirst] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

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
    setAiError(null);
    setLoadingAI(false);
    if (keepAi && mode === GAME_MODE.AI && aiFirst) {
      setNext(PLAYER.O);
    } else {
      setNext(PLAYER.X);
    }
  };

  // Winner/draw calculation
  useEffect(() => {
    const win = calculateWinner(board);
    if (win) {
      setWinner(win);
      setScores((prev) => ({ ...prev, [win]: prev[win] + 1 }));
      setLoadingAI(false);
    } else if (board.every((v) => v)) {
      setIsDraw(true);
      setLoadingAI(false);
    }
  }, [board]);

  // Async AI move logic
  useEffect(() => {
    async function aiMove() {
      // Player X = human, Player O = AI, AI is always O
      if (
        mode !== GAME_MODE.AI ||
        next !== PLAYER.O ||
        winner ||
        isDraw ||
        loadingAI
      ) {
        return;
      }
      setLoadingAI(true);
      setAiError(null);
      let idx;
      try {
        idx = await getOpenAIMove(board, PLAYER.O);
        setTimeout(() => {
          setBoard(prev => {
            if (prev[idx]) return prev; // skip if already filled
            const b = prev.slice();
            b[idx] = PLAYER.O;
            return b;
          });
          setNext(PLAYER.X);
          setLoadingAI(false);
        }, 500); // small delay for UX
      } catch (e) {
        setAiError(e.message || "AI failed. Try again!");
        setLoadingAI(false);
        // fallback for now: skip turn or show error
      }
    }
    aiMove();
    // eslint-disable-next-line
  }, [mode, next, winner, isDraw, loadingAI]);

  // PUBLIC_INTERFACE
  const handleSquareClick = (idx) => {
    if (board[idx] || winner || isDraw || (mode === GAME_MODE.AI && next === PLAYER.O) || loadingAI)
      return;
    const newBoard = board.slice();
    newBoard[idx] = next;
    setBoard(newBoard);
    setNext(next === PLAYER.X ? PLAYER.O : PLAYER.X);
  };

  // PUBLIC_INTERFACE
  const handleModeChange = (newMode) => {
    setMode(newMode);
    setAiFirst(newMode === GAME_MODE.AI);
    setScores({ X: 0, O: 0 });
    setBoard(Array(9).fill(null));
    setWinner(null);
    setIsDraw(false);
    setAiError(null);
    setLoadingAI(false);
    setNext(newMode === GAME_MODE.AI ? PLAYER.O : PLAYER.X);
  };

  // UI helpers
  const statusMessage = () => {
    if (winner) return `Winner: ${winner}`;
    if (isDraw) return "It's a draw!";
    if (mode === GAME_MODE.AI && loadingAI) return "AI is thinking...";
    if (mode === GAME_MODE.AI && next === PLAYER.O) return "AI's turn (O)";
    return `Next: ${next}`;
  };

  return (
    <div className="App tic-app-root">
      <header className="tic-header">
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
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
            next={next}
            aiEnabled={mode === GAME_MODE.AI}
            loadingAI={loadingAI}
          />
          <div className="tic-status" style={{ color: COLOR.secondary }}>
            {statusMessage()}
            {aiError && (
              <div style={{ color: "#dd2222", marginTop: 8, fontWeight: 600 }}>
                AI Error: {aiError}
              </div>
            )}
          </div>
        </section>
        <section className="tic-controls">
          <div className="tic-mode">
            <button
              className={`tic-btn${mode === GAME_MODE.HUMAN ? " active" : ""}`}
              style={{ background: mode === GAME_MODE.HUMAN ? COLOR.primary : undefined }}
              onClick={() => handleModeChange(GAME_MODE.HUMAN)}
              disabled={mode === GAME_MODE.HUMAN}
              tabIndex="0"
            >2 Player</button>
            <button
              className={`tic-btn${mode === GAME_MODE.AI ? " active" : ""}`}
              style={{ background: mode === GAME_MODE.AI ? COLOR.primary : undefined, marginLeft: 8 }}
              onClick={() => handleModeChange(GAME_MODE.AI)}
              disabled={mode === GAME_MODE.AI}
              tabIndex="0"
            >Play vs AI</button>
          </div>
          <button className="tic-btn tic-restart-btn" onClick={() => restart(true)} style={{ background: COLOR.accent, color: '#212121' }}>
            Restart
          </button>
        </section>
        <section>
          {mode === GAME_MODE.AI ? (
            <div style={{ fontSize: '0.98em', color: '#888', marginTop: 16 }}>
              <b>AI Powered by OpenAI GPT • Uses <code>REACT_APP_OPENAI_API_KEY</code> (.env)</b>
            </div>
          ) : null}
        </section>
      </main>
      <footer className="tic-footer">
        <span>
          <a href="https://reactjs.org/" target="_blank" rel="noopener noreferrer">React</a> Tic Tac Toe &middot; Minimal UI &middot;{" "}
          <span style={{ color: COLOR.accent, fontWeight: 600 }}>Light Theme</span>
        </span>
      </footer>
    </div>
  );
}

// PUBLIC_INTERFACE
function GameBoard({ squares, onSquareClick, winner, aiEnabled, next, loadingAI }) {
  /** Board drawing, disables squares when winner or AI turn or AI loading */
  return (
    <div className="tic-board">
      {squares.map((val, idx) => (
        <Square
          key={idx}
          value={val}
          highlight={false}
          onClick={() => onSquareClick(idx)}
          disabled={!!val || !!winner || (aiEnabled && (next === PLAYER.O || loadingAI))}
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
      className={`tic-square${highlight ? " highlight" : ""}`}
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
