import React, { useState, useEffect } from 'react';
import { Gamepad2, RotateCcw, Trophy, Sparkles, User } from 'lucide-react';

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const TicTacToeCard = ({
  messageId,
  currentUserId,
  currentUsername,
  onSendGameMove,
  subscribe,
}) => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [turn, setTurn] = useState('X'); // 'X' starts
  const [winner, setWinner] = useState(null); // 'X' | 'O' | 'draw' | null
  const [winningLine, setWinningLine] = useState([]);
  const [playerX, setPlayerX] = useState(currentUsername || 'Player X');
  const [playerO, setPlayerO] = useState('Player O');

  const checkWinner = (squares) => {
    for (let combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a], line: combo };
      }
    }
    if (squares.every((sq) => sq !== null)) {
      return { winner: 'draw', line: [] };
    }
    return { winner: null, line: [] };
  };

  const handleCellClick = (index) => {
    if (board[index] || winner) return;

    const nextBoard = [...board];
    nextBoard[index] = turn;
    const result = checkWinner(nextBoard);

    setBoard(nextBoard);
    setTurn(turn === 'X' ? 'O' : 'X');
    if (result.winner) {
      setWinner(result.winner);
      setWinningLine(result.line);
    }

    // Broadcast move to other players in room
    if (onSendGameMove) {
      onSendGameMove({
        type: 'game_move',
        message_id: messageId,
        index,
        player: turn,
        next_turn: turn === 'X' ? 'O' : 'X',
        winner: result.winner,
        line: result.line,
        board: nextBoard,
      });
    }
  };

  const handleReset = () => {
    const freshBoard = Array(9).fill(null);
    setBoard(freshBoard);
    setTurn('X');
    setWinner(null);
    setWinningLine([]);

    if (onSendGameMove) {
      onSendGameMove({
        type: 'game_reset',
        message_id: messageId,
        board: freshBoard,
      });
    }
  };

  // Direct socket listener for moves
  useEffect(() => {
    if (!subscribe) return;

    const unsubGame = subscribe('game_move', (payload) => {
      if (payload.board) {
        setBoard(payload.board);
        setTurn(payload.next_turn || 'X');
        if (payload.winner) {
          setWinner(payload.winner);
          setWinningLine(payload.line || []);
        }
      }
    });

    const unsubReset = subscribe('game_reset', () => {
      setBoard(Array(9).fill(null));
      setTurn('X');
      setWinner(null);
      setWinningLine([]);
    });

    return () => {
      unsubGame();
      unsubReset();
    };
  }, [subscribe]);

  return (
    <div className="w-full max-w-xs p-4 rounded-3xl glass-card border border-white/10 shadow-2xl my-2 animate-slide-up select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-white text-black font-bold shadow-md">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Tic-Tac-Toe Live</h4>
            <p className="text-[10px] text-zinc-400">Multiplayer In-Chat Game</p>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
          title="Restart Game"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Turn & Status Indicator */}
      <div className="py-2.5 text-center">
        {winner ? (
          winner === 'draw' ? (
            <span className="text-xs font-bold text-zinc-300">🤝 It's a Draw!</span>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 animate-pulse">
              <Trophy className="w-3.5 h-3.5" />
              <span>Player {winner} Won! 🎉</span>
            </div>
          )
        ) : (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-300">
            <span>Turn:</span>
            <span
              className={`px-2 py-0.5 rounded-md font-mono ${
                turn === 'X' ? 'bg-white text-black font-extrabold' : 'bg-zinc-800 text-white'
              }`}
            >
              Player {turn}
            </span>
          </div>
        )}
      </div>

      {/* 3x3 Game Grid */}
      <div className="grid grid-cols-3 gap-2 my-2 bg-black/60 p-2 rounded-2xl border border-white/5">
        {board.map((cell, idx) => {
          const isWinningCell = winningLine.includes(idx);
          return (
            <button
              key={idx}
              onClick={() => handleCellClick(idx)}
              disabled={cell !== null || winner !== null}
              className={`h-16 rounded-xl font-bold font-mono text-xl flex items-center justify-center transition-all ${
                isWinningCell
                  ? 'bg-emerald-500 text-black scale-105 shadow-lg'
                  : cell
                  ? cell === 'X'
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-white'
                  : 'bg-[#18181b] hover:bg-zinc-800 text-transparent hover:text-zinc-600'
              }`}
            >
              {cell || '-'}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default TicTacToeCard;
