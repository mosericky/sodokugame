export type Board = number[][];
export type Notes = Set<number>[][];

export type Difficulty = "easy" | "medium" | "hard";

const EMPTY = 0;

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = arr[i]!;
    const b = arr[j]!;
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

export function createEmptyBoard(): Board {
  return Array.from({ length: 9 }, () => Array(9).fill(EMPTY));
}

export function createEmptyNotes(): Notes {
  return Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<number>())
  );
}

export function copyBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function copyNotes(notes: Notes): Notes {
  return notes.map((row) => row.map((cell) => new Set(cell)));
}

export function isValidMove(
  board: Board,
  row: number,
  col: number,
  num: number
): boolean {
  for (let c = 0; c < 9; c++) {
    if (c !== col && board[row]![c]! === num) return false;
  }
  for (let r = 0; r < 9; r++) {
    if (r !== row && board[r]![col]! === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if ((r !== row || c !== col) && board[r]![c]! === num) return false;
    }
  }
  return true;
}

function fillBoard(board: Board): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]! === EMPTY) {
        const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (const num of nums) {
          if (isValidMove(board, row, col, num)) {
            board[row]![col] = num;
            if (fillBoard(board)) return true;
            board[row]![col] = EMPTY;
          }
        }
        return false;
      }
    }
  }
  return true;
}

function countSolutions(board: Board, limit = 2): number {
  let count = 0;

  function solve(): boolean {
    if (count >= limit) return true;
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row]![col]! === EMPTY) {
          for (let num = 1; num <= 9; num++) {
            if (isValidMove(board, row, col, num)) {
              board[row]![col] = num;
              if (solve()) return true;
              board[row]![col] = EMPTY;
            }
          }
          return false;
        }
      }
    }
    count++;
    return count >= limit;
  }

  solve();
  return count;
}

export function generatePuzzle(difficulty: Difficulty): {
  puzzle: Board;
  solution: Board;
} {
  const board = createEmptyBoard();
  fillBoard(board);
  const solution = copyBoard(board);

  const cellsToRemove = { easy: 38, medium: 48, hard: 56 }[difficulty];
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => ({
      row: Math.floor(i / 9),
      col: i % 9,
    }))
  );

  let removed = 0;
  for (const { row, col } of positions) {
    if (removed >= cellsToRemove) break;
    const original = board[row]![col]!;
    if (original === EMPTY) continue;
    board[row]![col] = EMPTY;
    const testBoard = copyBoard(board);
    if (countSolutions(testBoard, 2) === 1) {
      removed++;
    } else {
      board[row]![col] = original;
    }
  }

  return { puzzle: board, solution };
}

export function findConflicts(board: Board): Set<string> {
  const conflicts = new Set<string>();

  for (let row = 0; row < 9; row++) {
    const seen = new Map<number, number[]>();
    for (let col = 0; col < 9; col++) {
      const val = board[row]![col]!;
      if (val === EMPTY) continue;
      if (!seen.has(val)) seen.set(val, []);
      seen.get(val)!.push(col);
    }
    for (const cols of seen.values()) {
      if (cols.length > 1) {
        cols.forEach((col) => conflicts.add(`${row},${col}`));
      }
    }
  }

  for (let col = 0; col < 9; col++) {
    const seen = new Map<number, number[]>();
    for (let row = 0; row < 9; row++) {
      const val = board[row]![col]!;
      if (val === EMPTY) continue;
      if (!seen.has(val)) seen.set(val, []);
      seen.get(val)!.push(row);
    }
    for (const rows of seen.values()) {
      if (rows.length > 1) {
        rows.forEach((row) => conflicts.add(`${row},${col}`));
      }
    }
  }

  for (let boxRow = 0; boxRow < 3; boxRow++) {
    for (let boxCol = 0; boxCol < 3; boxCol++) {
      const seen = new Map<number, Array<[number, number]>>();
      for (let r = boxRow * 3; r < boxRow * 3 + 3; r++) {
        for (let c = boxCol * 3; c < boxCol * 3 + 3; c++) {
          const val = board[r]![c]!;
          if (val === EMPTY) continue;
          if (!seen.has(val)) seen.set(val, []);
          seen.get(val)!.push([r, c]);
        }
      }
      for (const cells of seen.values()) {
        if (cells.length > 1) {
          cells.forEach(([r, c]) => conflicts.add(`${r},${c}`));
        }
      }
    }
  }

  return conflicts;
}

export function isBoardComplete(board: Board): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]! === EMPTY) return false;
    }
  }
  return findConflicts(board).size === 0;
}

export function getHint(board: Board, solution: Board): [number, number] | null {
  const emptyCells: [number, number][] = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (board[row]![col]! === EMPTY) emptyCells.push([row, col]);
    }
  }
  if (emptyCells.length === 0) return null;
  return emptyCells[Math.floor(Math.random() * emptyCells.length)]!;
}
