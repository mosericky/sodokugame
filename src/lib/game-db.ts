import type { Board, Difficulty, Notes } from "@/lib/sudoku";

export type GameSnapshot = {
  board: Board;
  notes: Notes;
};

export type SavedGameRecord = {
  id: string;
  difficulty: Difficulty;
  initialPuzzle: Board;
  solution: Board;
  board: Board;
  notes: Notes;
  history: GameSnapshot[];
  historyIndex: number;
  seconds: number;
  won: boolean;
  createdAt: number;
  updatedAt: number;
};

export type HighScoreRecord = {
  id: string;
  difficulty: Difficulty;
  seconds: number;
  completedAt: number;
};

const DB_NAME = "sudoku-spark-db";
const DB_VERSION = 1;
const SAVE_KEY = "active";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("saves")) {
        db.createObjectStore("saves", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("scores")) {
        db.createObjectStore("scores", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open database."));
  });
}

function readFromStore<T>(storeName: string, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then((db) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve((request.result as T | undefined) ?? undefined);
        request.onerror = () => reject(request.error ?? new Error(`Unable to read ${storeName}.`));

        tx.oncomplete = () => db.close();
      })
      .catch(reject);
  });
}

function writeToStore<T>(storeName: string, value: T): Promise<void> {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.put(value);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Unable to save to ${storeName}.`));

        tx.oncomplete = () => db.close();
      })
      .catch(reject);
  });
}

function deleteFromStore(storeName: string, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    openDatabase()
      .then((db) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error(`Unable to delete from ${storeName}.`));

        tx.oncomplete = () => db.close();
      })
      .catch(reject);
  });
}

export async function saveGameProgress(record: SavedGameRecord): Promise<void> {
  await writeToStore("saves", record);
}

export async function loadGameProgress(): Promise<SavedGameRecord | undefined> {
  return readFromStore<SavedGameRecord>("saves", SAVE_KEY);
}

export async function clearSavedGame(): Promise<void> {
  await deleteFromStore("saves", SAVE_KEY);
}

export async function saveHighScore(score: HighScoreRecord): Promise<void> {
  await writeToStore("scores", {
    ...score,
    id: score.id || crypto.randomUUID(),
  });
}

export async function getRecentScores(limit = 5): Promise<HighScoreRecord[]> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("scores", "readonly");
    const store = tx.objectStore("scores");
    const request = store.getAll();

    request.onsuccess = () => {
      const scores = (request.result as HighScoreRecord[])
        .sort((a, b) => a.seconds - b.seconds || b.completedAt - a.completedAt)
        .slice(0, limit);

      resolve(scores);
      db.close();
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Unable to load scores."));
      db.close();
    };
  });
}
