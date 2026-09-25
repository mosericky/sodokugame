import { useEffect, useState, useCallback, useRef } from "react";
import {
  RotateCcw,
  Undo2,
  Redo2,
  Eraser,
  Pencil,
  Lightbulb,
  Trophy,
  Database,
  Save,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Board,
  Notes,
  Difficulty,
  createEmptyBoard,
  createEmptyNotes,
  copyBoard,
  copyNotes,
  generatePuzzle,
  findConflicts,
  isBoardComplete,
  getHint,
} from "@/lib/sudoku";
import {
  clearSavedGame,
  getRecentScores,
  loadGameProgress,
  saveGameProgress,
  saveHighScore,
  type HighScoreRecord,
  type SavedGameRecord,
} from "@/lib/game-db";

interface GameSnapshot {
  board: Board;
  notes: Notes;
}

export default function SudokuGame() {
  const [mounted, setMounted] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [initialPuzzle, setInitialPuzzle] = useState<Board>(createEmptyBoard());
  const [solution, setSolution] = useState<Board>(createEmptyBoard());
  const [board, setBoard] = useState<Board>(createEmptyBoard());
  const [notes, setNotes] = useState<Notes>(createEmptyNotes());
  const [history, setHistory] = useState<GameSnapshot[]>([
    { board: createEmptyBoard(), notes: createEmptyNotes() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [notesMode, setNotesMode] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [won, setWon] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [bestScores, setBestScores] = useState<HighScoreRecord[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);

  const conflicts = findConflicts(board);

  const startNewGame = useCallback(async (level: Difficulty) => {
    setIsGenerating(true);
    setIsRunning(false);
    setWon(false);
    setSeconds(0);
    setSelectedCell(null);
    setNotesMode(false);
    setSaveMessage(null);

    // Yield to UI so the loading state renders before generation blocks.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { puzzle, solution } = generatePuzzle(level);
    setDifficulty(level);
    setInitialPuzzle(puzzle);
    setSolution(solution);
    setBoard(puzzle.map((row) => [...row]));
    setNotes(createEmptyNotes());
    setHistory([{ board: copyBoard(puzzle), notes: createEmptyNotes() }]);
    setHistoryIndex(0);
    setIsRunning(true);
    setIsGenerating(false);
  }, []);

  const loadSavedGame = useCallback(async () => {
    try {
      const saved = await loadGameProgress();
      if (!saved) {
        await startNewGame("medium");
        return;
      }

      setDifficulty(saved.difficulty);
      setInitialPuzzle(saved.initialPuzzle);
      setSolution(saved.solution);
      setBoard(saved.board);
      setNotes(saved.notes);
      setHistory(saved.history.length > 0 ? saved.history : [{ board: copyBoard(saved.board), notes: copyNotes(saved.notes) }]);
      setHistoryIndex(saved.historyIndex);
      setSeconds(saved.seconds);
      setWon(saved.won);
      setIsRunning(!saved.won);
      setSaveMessage("Resumed your saved game.");
    } catch {
      setSaveMessage("Saved game unavailable in this browser.");
      await startNewGame("medium");
    }
  }, [startNewGame]);

  useEffect(() => {
    setMounted(true);
    void loadSavedGame();
  }, [loadSavedGame]);

  useEffect(() => {
    if (!isRunning || won) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, won]);

  const persistCurrentGame = useCallback(async () => {
    if (isGenerating || !mounted) return;

    const record: SavedGameRecord = {
      id: "active",
      difficulty,
      initialPuzzle,
      solution,
      board,
      notes,
      history,
      historyIndex,
      seconds,
      won,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await saveGameProgress(record);
      setSaveMessage("Game saved locally.");
    } catch {
      setSaveMessage("Save failed — browser storage is unavailable.");
    }
  }, [board, difficulty, history, historyIndex, initialPuzzle, isGenerating, mounted, notes, seconds, solution, won]);

  useEffect(() => {
    if (!mounted || isGenerating) return;

    const timeout = window.setTimeout(() => {
      void persistCurrentGame();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [board, history, historyIndex, initialPuzzle, isGenerating, mounted, notes, persistCurrentGame, seconds, solution, won]);

  useEffect(() => {
    void getRecentScores(5).then(setBestScores).catch(() => setBestScores([]));
  }, [won, seconds]);

  useEffect(() => {
    if (!won) return;

    const score: HighScoreRecord = {
      id: crypto.randomUUID(),
      difficulty,
      seconds,
      completedAt: Date.now(),
    };

    void saveHighScore(score)
      .then(() => getRecentScores(5))
      .then(setBestScores)
      .catch(() => setBestScores([]));
  }, [difficulty, seconds, won]);

  const pushHistory = useCallback(
    (newBoard: Board, newNotes: Notes) => {
      const trimmed = history.slice(0, historyIndex + 1);
      setHistory([...trimmed, { board: newBoard, notes: newNotes }]);
      setHistoryIndex(trimmed.length);
    },
    [history, historyIndex]
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const next = historyIndex - 1;
      setHistoryIndex(next);
      setBoard(copyBoard(history[next]!.board));
      setNotes(copyNotes(history[next]!.notes));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = historyIndex + 1;
      setHistoryIndex(next);
      setBoard(copyBoard(history[next]!.board));
      setNotes(copyNotes(history[next]!.notes));
    }
  }, [history, historyIndex]);

  const setCellValue = useCallback(
    (row: number, col: number, value: number) => {
      if (initialPuzzle[row]![col]! !== 0) return;

      const newBoard = copyBoard(board);
      const newNotes = copyNotes(notes);

      if (notesMode) {
        if (newBoard[row]![col]! !== 0) return;
        const cellNotes = newNotes[row]![col]!;
        if (cellNotes.has(value)) {
          cellNotes.delete(value);
        } else {
          cellNotes.add(value);
        }
        setNotes(newNotes);
        pushHistory(newBoard, newNotes);
      } else {
        newNotes[row]![col]!.clear();
        newBoard[row]![col] = value;
        setBoard(newBoard);
        setNotes(newNotes);
        pushHistory(newBoard, newNotes);

        if (isBoardComplete(newBoard)) {
          setWon(true);
          setIsRunning(false);
        }
      }
    },
    [board, notes, initialPuzzle, notesMode, pushHistory]
  );

  const clearCell = useCallback(
    (row: number, col: number) => {
      if (initialPuzzle[row]![col]! !== 0) return;
      const newBoard = copyBoard(board);
      const newNotes = copyNotes(notes);
      newBoard[row]![col] = 0;
      newNotes[row]![col]!.clear();
      setBoard(newBoard);
      setNotes(newNotes);
      pushHistory(newBoard, newNotes);
    },
    [board, notes, initialPuzzle, pushHistory]
  );

  const handleHint = useCallback(() => {
    const hint = getHint(board, solution);
    if (!hint) return;
    const [row, col] = hint;
    setCellValue(row, col, solution[row]![col]!);
    setSelectedCell([row, col]);
  }, [board, solution, setCellValue]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!selectedCell) return;
      const [row, col] = selectedCell;

      if (e.key === "n" || e.key === "N") {
        setNotesMode((m) => !m);
        return;
      }
      if (e.key === "ArrowUp") {
        setSelectedCell([Math.max(0, row - 1), col]);
        return;
      }
      if (e.key === "ArrowDown") {
        setSelectedCell([Math.min(8, row + 1), col]);
        return;
      }
      if (e.key === "ArrowLeft") {
        setSelectedCell([row, Math.max(0, col - 1)]);
        return;
      }
      if (e.key === "ArrowRight") {
        setSelectedCell([row, Math.min(8, col + 1)]);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        clearCell(row, col);
        return;
      }
      if (e.key === "z" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9) {
        setCellValue(row, col, num);
      }
    },
    [selectedCell, clearCell, undo, redo, setCellValue]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const selectedValue = selectedCell
    ? board[selectedCell[0]]![selectedCell[1]]!
    : null;

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Loading Sudoku…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-2xl">
        <header className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Sudoku
            </h1>
            <p className="text-sm text-muted-foreground">
              Fill every row, column, and 3×3 box with digits 1–9.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border bg-card px-4 py-2 font-mono text-lg font-semibold text-card-foreground shadow-sm">
              {formatTime(seconds)}
            </div>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            value={difficulty}
            onValueChange={(v) => {
              const level = v as Difficulty;
              setDifficulty(level);
              startNewGame(level);
            }}
            disabled={isGenerating}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="hard">Hard</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => startNewGame(difficulty)}
            disabled={isGenerating}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            New Game
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void persistCurrentGame()}
            disabled={isGenerating}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void loadSavedGame();
            }}
            disabled={isGenerating}
          >
            <Upload className="mr-2 h-4 w-4" />
            Load Saved
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void clearSavedGame().then(() => {
                setSaveMessage("Saved game cleared.");
                setHistory([{ board: copyBoard(initialPuzzle), notes: createEmptyNotes() }]);
                setHistoryIndex(0);
              });
            }}
            disabled={isGenerating}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear Save
          </Button>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={undo}
              disabled={historyIndex === 0 || isGenerating}
              aria-label="Undo"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={redo}
              disabled={historyIndex === history.length - 1 || isGenerating}
              aria-label="Redo"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button
              variant={notesMode ? "secondary" : "outline"}
              size="sm"
              onClick={() => setNotesMode((m) => !m)}
              disabled={isGenerating}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Notes
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                if (selectedCell) clearCell(selectedCell[0], selectedCell[1]);
              }}
              disabled={!selectedCell || isGenerating}
              aria-label="Erase"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleHint}
              disabled={isGenerating}
              aria-label="Hint"
            >
              <Lightbulb className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Database className="h-4 w-4" />
            {saveMessage ?? "Auto-saves locally in your browser."}
          </span>
        </div>

        <div
          ref={boardRef}
          className={`relative mx-auto mb-6 w-full max-w-[520px] select-none rounded-xl border-2 border-foreground/20 bg-card p-1 shadow-lg ${
            isGenerating ? "opacity-60" : ""
          }`}
        >
          <div className="grid aspect-square grid-cols-9 grid-rows-9 overflow-hidden rounded-lg">
            {board.map((row, r) =>
              row.map((value, c) => {
                const isFixed = initialPuzzle[r]![c]! !== 0;
                const [sr, sc] = selectedCell ?? [-1, -1];
                const isSelected = sr === r && sc === c;
                const isPeer =
                  selectedCell !== null &&
                  (sr === r || sc === c ||
                    (Math.floor(sr / 3) === Math.floor(r / 3) &&
                      Math.floor(sc / 3) === Math.floor(c / 3)));
                const isSameNumber =
                  selectedValue !== null &&
                  selectedValue !== 0 &&
                  value === selectedValue;
                const isConflict = conflicts.has(`${r},${c}`);
                const cellNotes = notes[r]![c]!;

                const thickRight = c === 2 || c === 5;
                const thickBottom = r === 2 || r === 5;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    onClick={() => setSelectedCell([r, c])}
                    className={[
                      "relative flex items-center justify-center text-2xl font-semibold outline-none transition-colors focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring",
                      "border border-border/60",
                      thickRight ? "border-r-2 border-r-foreground/20" : "",
                      thickBottom ? "border-b-2 border-b-foreground/20" : "",
                      isSelected
                        ? "bg-primary/20 ring-2 ring-inset ring-primary"
                        : isSameNumber
                          ? "bg-primary/15"
                          : isPeer
                            ? "bg-muted"
                            : "bg-card",
                      isConflict
                        ? "text-destructive"
                        : isFixed
                          ? "text-foreground"
                          : "text-primary",
                      isFixed ? "font-bold" : "font-medium",
                    ].join(" ")}
                    aria-label={`Row ${r + 1}, Column ${c + 1}`}
                    aria-selected={isSelected}
                  >
                    {value !== 0 ? (
                      <span>{value}</span>
                    ) : cellNotes.size > 0 ? (
                      <span className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0 p-0.5 text-[10px] font-normal leading-none text-muted-foreground">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                          <span
                            key={n}
                            className={`flex items-center justify-center ${
                              cellNotes.has(n) ? "opacity-100" : "opacity-0"
                            }`}
                          >
                            {n}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>

          {won && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-sm">
              <div className="max-w-xs rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Trophy className="h-6 w-6" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  Puzzle Solved!
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  You finished the {difficulty} puzzle in {formatTime(seconds)}.
                </p>
                <Button
                  className="mt-4 w-full"
                  onClick={() => startNewGame(difficulty)}
                >
                  Play Again
                </Button>
              </div>
            </div>
          )}

          {isGenerating && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/60">
              <div className="flex flex-col items-center gap-2">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <span className="text-sm font-medium text-foreground">
                  Generating puzzle…
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mx-auto grid max-w-[520px] grid-cols-5 gap-2 sm:grid-cols-9">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <Button
              key={num}
              variant="outline"
              size="lg"
              className="aspect-square text-xl font-semibold"
              onClick={() => {
                if (selectedCell) setCellValue(selectedCell[0], selectedCell[1], num);
              }}
              disabled={!selectedCell || isGenerating}
            >
              {num}
            </Button>
          ))}
        </div>

        <div className="mx-auto mt-6 max-w-[520px] rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Best Times</h3>
            <span className="text-xs text-muted-foreground">Top 5</span>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            {bestScores.length === 0 ? (
              <p>No saved wins yet. Finish a puzzle to add a score.</p>
            ) : (
              bestScores.map((score, index) => (
                <div
                  key={score.id}
                  className="flex items-center justify-between rounded-md bg-muted/60 px-2 py-1.5"
                >
                  <span>
                    #{index + 1} · {score.difficulty}
                  </span>
                  <span className="font-mono text-foreground">
                    {`${Math.floor(score.seconds / 60)
                      .toString()
                      .padStart(2, "0")}:${(score.seconds % 60)
                      .toString()
                      .padStart(2, "0")}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Use number keys to fill cells. Press{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-foreground">
            N
          </kbd>{" "}
          to toggle notes, arrow keys to move, and{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-foreground">
            Backspace
          </kbd>{" "}
          to erase.
        </p>
      </div>
    </div>
  );
}
