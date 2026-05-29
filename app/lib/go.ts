export const BOARD_SIZE = 19;
export const COLUMN_LABELS = "ABCDEFGHJKLMNOPQRST".split("");

export type Player = "black" | "white";

export interface Point {
  row: number;
  col: number;
}

export interface BoardCell {
  color: Player;
  moveNumber: number;
}

export type Board = Array<Array<BoardCell | null>>;

export interface MoveRecord {
  captured: number;
  moveNumber: number;
  player: Player;
  point: Point | null;
  type: "pass" | "play";
}

export interface GameState {
  board: Board;
  boardHash: string;
  captures: Record<Player, number>;
  consecutivePasses: number;
  currentPlayer: Player;
  lastMove: Point | null;
  moveNumber: number;
  moves: MoveRecord[];
  previousBoardHash: string | null;
}

export interface MoveResult {
  error?: string;
  state: GameState | null;
}

const PLAYER_NAMES: Record<Player, string> = {
  black: "Black",
  white: "White",
};

export function getPlayerName(player: Player) {
  return PLAYER_NAMES[player];
}

export function getOpponent(player: Player): Player {
  return player === "black" ? "white" : "black";
}

export function formatCoordinate(row: number, col: number) {
  return `${COLUMN_LABELS[col]}${BOARD_SIZE - row}`;
}

export function createInitialGameState(): GameState {
  const board = createEmptyBoard();

  return {
    board,
    boardHash: serializeBoard(board),
    captures: {
      black: 0,
      white: 0,
    },
    consecutivePasses: 0,
    currentPlayer: "black",
    lastMove: null,
    moveNumber: 0,
    moves: [],
    previousBoardHash: null,
  };
}

export function passTurn(state: GameState): GameState {
  return {
    ...state,
    consecutivePasses: state.consecutivePasses + 1,
    currentPlayer: getOpponent(state.currentPlayer),
    lastMove: null,
    moveNumber: state.moveNumber + 1,
    moves: [
      ...state.moves,
      {
        captured: 0,
        moveNumber: state.moveNumber + 1,
        player: state.currentPlayer,
        point: null,
        type: "pass",
      },
    ],
    previousBoardHash: state.boardHash,
  };
}

export function playMove(
  state: GameState,
  row: number,
  col: number,
): MoveResult {
  if (!isOnBoard(row, col)) {
    return {
      error: "That point is outside the board.",
      state: null,
    };
  }

  if (state.board[row][col]) {
    return {
      error: `${getPlayerName(state.currentPlayer)} cannot play on ${formatCoordinate(row, col)} because that point is occupied.`,
      state: null,
    };
  }

  const nextBoard = cloneBoard(state.board);
  nextBoard[row][col] = {
    color: state.currentPlayer,
    moveNumber: state.moveNumber + 1,
  };

  const opponent = getOpponent(state.currentPlayer);
  const inspectedEnemyStones = new Set<string>();
  const capturedGroups: Point[][] = [];

  for (const neighbor of getNeighbors(row, col)) {
    const neighborCell = nextBoard[neighbor.row][neighbor.col];

    if (!neighborCell || neighborCell.color !== opponent) {
      continue;
    }

    const neighborKey = pointKey(neighbor.row, neighbor.col);

    if (inspectedEnemyStones.has(neighborKey)) {
      continue;
    }

    const group = collectGroup(nextBoard, neighbor.row, neighbor.col);

    for (const stone of group.stones) {
      inspectedEnemyStones.add(pointKey(stone.row, stone.col));
    }

    if (group.liberties.size === 0) {
      capturedGroups.push(group.stones);
    }
  }

  const capturedStones = capturedGroups.flat();

  if (capturedStones.length > 0) {
    removeStones(nextBoard, capturedStones);
  }

  const ownGroup = collectGroup(nextBoard, row, col);

  if (ownGroup.liberties.size === 0) {
    return {
      error: `${getPlayerName(state.currentPlayer)} cannot play ${formatCoordinate(row, col)} because suicide is not allowed.`,
      state: null,
    };
  }

  const nextBoardHash = serializeBoard(nextBoard);

  if (state.previousBoardHash && nextBoardHash === state.previousBoardHash) {
    return {
      error: `${getPlayerName(state.currentPlayer)} cannot play ${formatCoordinate(row, col)} because of ko.`,
      state: null,
    };
  }

  return {
    state: {
      board: nextBoard,
      boardHash: nextBoardHash,
      captures: {
        ...state.captures,
        [state.currentPlayer]:
          state.captures[state.currentPlayer] + capturedStones.length,
      },
      consecutivePasses: 0,
      currentPlayer: opponent,
      lastMove: {
        row,
        col,
      },
      moveNumber: state.moveNumber + 1,
      moves: [
        ...state.moves,
        {
          captured: capturedStones.length,
          moveNumber: state.moveNumber + 1,
          player: state.currentPlayer,
          point: {
            row,
            col,
          },
          type: "play",
        },
      ],
      previousBoardHash: state.boardHash,
    },
  };
}

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null),
  );
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.slice());
}

function serializeBoard(board: Board) {
  return board
    .map((row) =>
      row
        .map((cell) => {
          if (!cell) {
            return ".";
          }

          return cell.color === "black" ? "b" : "w";
        })
        .join(""),
    )
    .join("|");
}

function removeStones(board: Board, stones: Point[]) {
  for (const stone of stones) {
    board[stone.row][stone.col] = null;
  }
}

function collectGroup(board: Board, startRow: number, startCol: number) {
  const startCell = board[startRow][startCol];

  if (!startCell) {
    return {
      liberties: new Set<string>(),
      stones: [] as Point[],
    };
  }

  const stones: Point[] = [];
  const liberties = new Set<string>();
  const seen = new Set<string>([pointKey(startRow, startCol)]);
  const stack: Point[] = [
    {
      row: startRow,
      col: startCol,
    },
  ];

  while (stack.length > 0) {
    const point = stack.pop();

    if (!point) {
      continue;
    }

    stones.push(point);

    for (const neighbor of getNeighbors(point.row, point.col)) {
      const neighborCell = board[neighbor.row][neighbor.col];

      if (!neighborCell) {
        liberties.add(pointKey(neighbor.row, neighbor.col));
        continue;
      }

      if (neighborCell.color !== startCell.color) {
        continue;
      }

      const neighborKey = pointKey(neighbor.row, neighbor.col);

      if (seen.has(neighborKey)) {
        continue;
      }

      seen.add(neighborKey);
      stack.push(neighbor);
    }
  }

  return {
    liberties,
    stones,
  };
}

function getNeighbors(row: number, col: number): Point[] {
  return [
    { row: row - 1, col },
    { row: row + 1, col },
    { row, col: col - 1 },
    { row, col: col + 1 },
  ].filter((point) => isOnBoard(point.row, point.col));
}

function isOnBoard(row: number, col: number) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function pointKey(row: number, col: number) {
  return `${row}:${col}`;
}
