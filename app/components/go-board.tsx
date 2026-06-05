"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import { saveSequenceAction } from "../sequences/actions";
import {
  BOARD_SIZE,
  COLUMN_LABELS,
  createInitialGameState,
  formatCoordinate,
  getPlayerName,
  passTurn,
  playMove,
  type GameState,
  type MoveRecord,
} from "../lib/go";

type LabelMode = "all" | "off" | "recent";
type NoticeTone = "error" | "info";

interface Notice {
  text: string;
  tone: NoticeTone;
}

interface GoBoardProps {
  canSaveSequences?: boolean;
}

const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, index) =>
  String(BOARD_SIZE - index),
);
const STAR_POINTS = [3, 9, 15].flatMap((row) =>
  [3, 9, 15].map((col) => ({ row, col })),
);

export default function GoBoard({ canSaveSequences = false }: GoBoardProps) {
  const [history, setHistory] = useState<GameState[]>(() => [
    createInitialGameState(),
  ]);
  const [labelMode, setLabelMode] = useState<LabelMode>("recent");
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [isSavingSequence, startSavingSequence] = useTransition();
  const [notice, setNotice] = useState<Notice>({
    text: "Click any intersection to begin sketching a joseki line.",
    tone: "info",
  });

  const state = history[history.length - 1];
  const recentMoves = state.moves.slice(-8).reverse();
  const lastMoveRecord =
    state.moves.length > 0 ? state.moves[state.moves.length - 1] : null;

  function handlePlay(row: number, col: number) {
    const result = playMove(state, row, col);

    if (!result.state) {
      setNotice({
        text: result.error ?? "That move is not legal.",
        tone: "error",
      });
      return;
    }

    const nextState = result.state;

    setHistory((currentHistory) => [...currentHistory, nextState]);
    setHoveredPoint(null);
    setNotice({
      text: `${getPlayerName(nextState.moves[nextState.moves.length - 1].player)} played ${formatCoordinate(row, col)}.`,
      tone: "info",
    });
  }

  function handleUndo() {
    if (history.length === 1) {
      return;
    }

    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setHoveredPoint(null);
    setNotice({
      text: "Stepped back one move.",
      tone: "info",
    });
  }

  function handlePass() {
    const nextState = passTurn(state);

    setHistory((currentHistory) => [...currentHistory, nextState]);
    setHoveredPoint(null);
    setNotice({
      text: `${getPlayerName(state.currentPlayer)} passed.`,
      tone: "info",
    });
  }

  function handleReset() {
    setHistory([createInitialGameState()]);
    setHoveredPoint(null);
    setNotice({
      text: "The board has been cleared for a fresh opening.",
      tone: "info",
    });
  }

  function cycleLabels() {
    setLabelMode((currentMode) => {
      if (currentMode === "recent") {
        return "all";
      }

      if (currentMode === "all") {
        return "off";
      }

      return "recent";
    });
  }

  function handleSaveSequence() {
    if (state.moves.length === 0) {
      setNotice({
        text: "Play at least one move before saving a sequence.",
        tone: "error",
      });
      return;
    }

    startSavingSequence(async () => {
      const result = await saveSequenceAction({
        boardHash: state.boardHash,
        moves: state.moves,
      });

      setNotice({
        text: result.message,
        tone: result.ok ? "info" : "error",
      });
    });
  }

  return (
    <section className="workbench" aria-labelledby="study-board-title">
      <div className="board-card">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Study Board</p>
            <h2 id="study-board-title" className="section-title">
              Play out joseki ideas directly on the goban
            </h2>
          </div>
          <p className="section-note">
            Captures, suicide prevention, and simple ko are live. Stones can
            show their sequence numbers so the opening shape stays readable.
          </p>
        </div>

        <div className="goban-frame">
          <div className="coordinate-row" aria-hidden="true">
            {COLUMN_LABELS.map((label) => (
              <span key={`top-${label}`}>{label}</span>
            ))}
          </div>

          <div className="board-middle">
            <div className="coordinate-column" aria-hidden="true">
              {ROW_LABELS.map((label) => (
                <span key={`left-${label}`}>{label}</span>
              ))}
            </div>

            <div className="goban-surface">
              <div
                className="goban-grid"
                role="group"
                aria-label="Interactive 19 by 19 Go board"
              >
                {STAR_POINTS.map((point) => (
                  <span
                    key={`star-${point.row}-${point.col}`}
                    className="star-point"
                    style={pointStyle(point.row, point.col)}
                  />
                ))}

                {state.board.map((row, rowIndex) =>
                  row.map((cell, colIndex) => {
                    const pointId = `${rowIndex}:${colIndex}`;
                    const coordinate = formatCoordinate(rowIndex, colIndex);
                    const isHovered = hoveredPoint === pointId;
                    const isLastMove =
                      state.lastMove?.row === rowIndex &&
                      state.lastMove?.col === colIndex;
                    const showNumber =
                      !!cell && shouldShowMoveNumber(cell.moveNumber, state.moveNumber, labelMode);

                    return (
                      <button
                        key={pointId}
                        type="button"
                        className="intersection"
                        style={pointStyle(rowIndex, colIndex)}
                        data-color={cell?.color}
                        data-hovered={isHovered || undefined}
                        data-last-move={isLastMove || undefined}
                        data-next-player={state.currentPlayer}
                        data-occupied={cell ? "true" : "false"}
                        onBlur={() => setHoveredPoint(null)}
                        onClick={() => handlePlay(rowIndex, colIndex)}
                        onFocus={() => {
                          if (!cell) {
                            setHoveredPoint(pointId);
                          }
                        }}
                        onMouseEnter={() => {
                          if (!cell) {
                            setHoveredPoint(pointId);
                          }
                        }}
                        onMouseLeave={() => setHoveredPoint((currentPoint) =>
                          currentPoint === pointId ? null : currentPoint,
                        )}
                        aria-label={
                          cell
                            ? `${getPlayerName(cell.color)} stone on ${coordinate}, move ${cell.moveNumber}`
                            : `Play ${getPlayerName(state.currentPlayer)} on ${coordinate}`
                        }
                        disabled={Boolean(cell)}
                      >
                        {showNumber ? (
                          <span className="stone-label">{cell.moveNumber}</span>
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>

            <div className="coordinate-column" aria-hidden="true">
              {ROW_LABELS.map((label) => (
                <span key={`right-${label}`}>{label}</span>
              ))}
            </div>
          </div>

          <div className="coordinate-row" aria-hidden="true">
            {COLUMN_LABELS.map((label) => (
              <span key={`bottom-${label}`}>{label}</span>
            ))}
          </div>
        </div>
      </div>

      <aside className="inspector-card">
        <div className="section-heading compact">
          <div>
            <p className="section-kicker">Board State</p>
            <h2 className="section-title">Quiet, useful signals</h2>
          </div>
          <p className="section-note">
            Enough context to study the shape without crowding the board.
          </p>
        </div>

        <div className="stat-grid">
          <div className="stat-tile">
            <span className="stat-label">To Play</span>
            <span className="stat-value">
              <span className="turn-chip" data-player={state.currentPlayer}>
                {getPlayerName(state.currentPlayer)}
              </span>
            </span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Move</span>
            <span className="stat-value">{state.moveNumber}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">Black Captures</span>
            <span className="stat-value">{state.captures.black}</span>
          </div>
          <div className="stat-tile">
            <span className="stat-label">White Captures</span>
            <span className="stat-value">{state.captures.white}</span>
          </div>
        </div>

        <div className="status-card">
          <p className="status-label">Latest update</p>
          <p className="status-message" data-tone={notice.tone} aria-live="polite">
            {notice.text}
          </p>
          <p className="status-meta">
            {lastMoveRecord ? describeMove(lastMoveRecord) : "No moves yet."}
          </p>
        </div>

        <div className="controls">
          <button type="button" className="control-button primary" onClick={handleUndo} disabled={history.length === 1}>
            Undo
          </button>
          <button type="button" className="control-button" onClick={handlePass}>
            Pass
          </button>
          <button type="button" className="control-button" onClick={cycleLabels}>
            Labels: {labelLabel(labelMode)}
          </button>
          <button type="button" className="control-button danger" onClick={handleReset}>
            Reset
          </button>
          {canSaveSequences ? (
            <button
              type="button"
              className="control-button primary sequence-save-button"
              onClick={handleSaveSequence}
              disabled={isSavingSequence || state.moves.length === 0}
            >
              {isSavingSequence ? "Saving..." : "Save sequence"}
            </button>
          ) : null}
        </div>

        <div className="moves-card">
          <div className="moves-header">
            <h3>Recent sequence</h3>
            <span>{recentMoves.length === 0 ? "empty" : `${recentMoves.length} shown`}</span>
          </div>
          <ol className="moves-list">
            {recentMoves.length === 0 ? (
              <li className="move-empty">The corner is still open.</li>
            ) : (
              recentMoves.map((move) => (
                <li key={move.moveNumber} className="move-row">
                  <span className="move-index">{move.moveNumber}</span>
                  <span className="move-player">{getPlayerName(move.player)}</span>
                  <span className="move-coordinate">{move.point ? formatCoordinate(move.point.row, move.point.col) : "Pass"}</span>
                </li>
              ))
            )}
          </ol>
        </div>
      </aside>
    </section>
  );
}

function pointStyle(row: number, col: number): CSSProperties {
  return {
    left: `${(col / (BOARD_SIZE - 1)) * 100}%`,
    top: `${(row / (BOARD_SIZE - 1)) * 100}%`,
  };
}

function shouldShowMoveNumber(
  moveNumber: number,
  latestMoveNumber: number,
  labelMode: LabelMode,
) {
  if (labelMode === "off") {
    return false;
  }

  if (labelMode === "all") {
    return true;
  }

  return moveNumber > latestMoveNumber - 10;
}

function labelLabel(labelMode: LabelMode) {
  if (labelMode === "all") {
    return "All";
  }

  if (labelMode === "off") {
    return "Off";
  }

  return "Recent";
}

function describeMove(move: MoveRecord) {
  if (move.type === "pass") {
    return `${getPlayerName(move.player)} passed on move ${move.moveNumber}.`;
  }

  if (!move.point) {
    return `Move ${move.moveNumber}.`;
  }

  const captureSuffix =
    move.captured > 0
      ? ` and captured ${move.captured} stone${move.captured === 1 ? "" : "s"}`
      : "";

  return `${getPlayerName(move.player)} played ${formatCoordinate(move.point.row, move.point.col)} on move ${move.moveNumber}${captureSuffix}.`;
}
