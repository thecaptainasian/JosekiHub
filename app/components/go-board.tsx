"use client";

import { useState, useTransition } from "react";
import type { CSSProperties } from "react";
import {
  getNextSavedMovesAction,
  saveSequenceAction,
} from "../sequences/actions";
import type { NextJosekiMove } from "../sequences/types";
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
  initialNextMoves?: NextJosekiMove[];
  initialNodeId?: string | null;
}

interface HistoryEntry {
  nodeId: string | null;
  state: GameState;
}

const ROW_LABELS = Array.from({ length: BOARD_SIZE }, (_, index) =>
  String(BOARD_SIZE - index),
);
const STAR_POINTS = [3, 9, 15].flatMap((row) =>
  [3, 9, 15].map((col) => ({ row, col })),
);

export default function GoBoard({
  canSaveSequences = false,
  initialNextMoves = [],
  initialNodeId = null,
}: GoBoardProps) {
  const [history, setHistory] = useState<HistoryEntry[]>(() => [
    {
      nodeId: initialNodeId,
      state: createInitialGameState(),
    },
  ]);
  const [nextMoves, setNextMoves] =
    useState<NextJosekiMove[]>(initialNextMoves);
  const [labelMode, setLabelMode] = useState<LabelMode>("recent");
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);
  const [isLoadingBranches, startLoadingBranches] = useTransition();
  const [isSavingSequence, startSavingSequence] = useTransition();
  const [notice, setNotice] = useState<Notice>({
    text: "Click any intersection to begin sketching a joseki line.",
    tone: "info",
  });

  const currentEntry = history[history.length - 1];
  const state = currentEntry.state;
  const currentNodeId = currentEntry.nodeId;
  const recentMoves = state.moves.slice(-8).reverse();
  const lastMoveRecord =
    state.moves.length > 0 ? state.moves[state.moves.length - 1] : null;
  const playableNextMoves = nextMoves.filter(
    (move) =>
      move.moveType === "play" &&
      move.row !== null &&
      move.col !== null &&
      !state.board[move.row]?.[move.col],
  );

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
    const matchingBranch = findNextMove(row, col, playableNextMoves);
    const nextNodeId = matchingBranch?.id ?? null;

    setHistory((currentHistory) => [
      ...currentHistory,
      {
        nodeId: nextNodeId,
        state: nextState,
      },
    ]);
    setHoveredPoint(null);
    setNotice({
      text: matchingBranch
        ? `${getPlayerName(nextState.moves[nextState.moves.length - 1].player)} followed a saved branch at ${formatCoordinate(row, col)}.`
        : `${getPlayerName(nextState.moves[nextState.moves.length - 1].player)} played ${formatCoordinate(row, col)} outside the saved tree.`,
      tone: "info",
    });
    loadNextSavedMoves(nextNodeId);
  }

  function handleIndicatorClick(move: NextJosekiMove) {
    if (move.moveType !== "play" || move.row === null || move.col === null) {
      return;
    }

    handlePlay(move.row, move.col);
  }

  function handleUndo() {
    if (history.length === 1) {
      return;
    }

    const previousEntry = history[history.length - 2];

    setHistory((currentHistory) => currentHistory.slice(0, -1));
    setHoveredPoint(null);
    setNotice({
      text: "Stepped back one move.",
      tone: "info",
    });
    loadNextSavedMoves(previousEntry.nodeId);
  }

  function handlePass() {
    const nextState = passTurn(state);
    const matchingBranch = nextMoves.find(
      (move) =>
        move.moveType === "pass" && move.player === state.currentPlayer,
    );
    const nextNodeId = matchingBranch?.id ?? null;

    setHistory((currentHistory) => [
      ...currentHistory,
      {
        nodeId: nextNodeId,
        state: nextState,
      },
    ]);
    setHoveredPoint(null);
    setNotice({
      text: matchingBranch
        ? `${getPlayerName(state.currentPlayer)} followed a saved pass branch.`
        : `${getPlayerName(state.currentPlayer)} passed outside the saved tree.`,
      tone: "info",
    });
    loadNextSavedMoves(nextNodeId);
  }

  function handleReset() {
    setHistory([
      {
        nodeId: initialNodeId,
        state: createInitialGameState(),
      },
    ]);
    setHoveredPoint(null);
    setNotice({
      text: "The board has been cleared for a fresh opening.",
      tone: "info",
    });
    loadNextSavedMoves(initialNodeId);
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

      if (result.ok && typeof result.terminalNodeId === "string") {
        setHistory((currentHistory) => {
          const nextHistory = currentHistory.slice();
          const latestEntry = nextHistory[nextHistory.length - 1];

          nextHistory[nextHistory.length - 1] = {
            ...latestEntry,
            nodeId: result.terminalNodeId,
          };

          return nextHistory;
        });
        setNextMoves(result.nextMoves ?? []);
      }
    });
  }

  function loadNextSavedMoves(nodeId: string | null) {
    if (!nodeId) {
      setNextMoves([]);
      return;
    }

    startLoadingBranches(async () => {
      const result = await getNextSavedMovesAction(nodeId);

      if (result.ok) {
        setNextMoves(result.moves);
        return;
      }

      setNextMoves([]);
      setNotice({
        text: result.message ?? "Unable to load saved branches.",
        tone: "error",
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
                    const branchMove = findNextMove(
                      rowIndex,
                      colIndex,
                      playableNextMoves,
                    );
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
                        data-saved-branch={branchMove ? "true" : undefined}
                        data-branch-style={
                          branchMove
                            ? String(playableNextMoves.indexOf(branchMove) % 4)
                            : undefined
                        }
                        onBlur={() => setHoveredPoint(null)}
                        onClick={() => {
                          if (branchMove) {
                            handleIndicatorClick(branchMove);
                            return;
                          }

                          handlePlay(rowIndex, colIndex);
                        }}
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
                            : branchMove
                              ? `Follow saved ${getPlayerName(branchMove.player)} branch on ${coordinate}`
                            : `Play ${getPlayerName(state.currentPlayer)} on ${coordinate}`
                        }
                        disabled={Boolean(cell)}
                      >
                        {renderNextMoveIndicator(branchMove)}
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
            {describeTreeStatus(
              currentNodeId,
              playableNextMoves.length,
              isLoadingBranches,
              lastMoveRecord,
            )}
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

function findNextMove(
  row: number,
  col: number,
  nextMoves: NextJosekiMove[],
) {
  return nextMoves.find((move) => move.row === row && move.col === col);
}

function renderNextMoveIndicator(move: NextJosekiMove | undefined) {
  if (!move) {
    return null;
  }

  return <span className="next-move-indicator" aria-hidden="true" />;
}

function describeTreeStatus(
  currentNodeId: string | null,
  nextMoveCount: number,
  isLoadingBranches: boolean,
  lastMoveRecord: MoveRecord | null,
) {
  if (isLoadingBranches) {
    return "Loading saved branches for this position.";
  }

  if (!currentNodeId) {
    return lastMoveRecord
      ? `${describeMove(lastMoveRecord)} This line is not in the saved tree yet.`
      : "No saved tree position is active.";
  }

  if (nextMoveCount > 0) {
    return `${nextMoveCount} saved next move${nextMoveCount === 1 ? "" : "s"} available from this position.`;
  }

  return lastMoveRecord
    ? `${describeMove(lastMoveRecord)} No saved continuations from here yet.`
    : "No saved first moves yet.";
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
