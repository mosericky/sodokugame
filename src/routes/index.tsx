import { createFileRoute } from "@tanstack/react-router";
import SudokuGame from "@/components/sudoku/SudokuGame";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Sudoku" },
      {
        name: "description",
        content:
          "Play a clean, modern Sudoku game with easy, medium, and hard puzzles. Track your time, use notes, and get hints.",
      },
      { property: "og:title", content: "Sudoku — Play a Daily Puzzle" },
      {
        property: "og:description",
        content:
          "Play a clean, modern Sudoku game with easy, medium, and hard puzzles. Track your time, use notes, and get hints.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Index() {
  return <SudokuGame />;
}
