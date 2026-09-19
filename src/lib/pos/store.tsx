import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PosDatabase, PosUser } from "./types";
import { emptyDatabase } from "./seed";
import {
  loadDatabase,
  saveDatabase,
  readLocal,
  writeLocal,
  removeLocal,
  SESSION_STORAGE_KEY,
} from "./storage";

interface PosContextValue {
  ready: boolean;
  db: PosDatabase;
  update: (updater: (db: PosDatabase) => PosDatabase) => void;
  replaceAll: (db: PosDatabase) => void;
  currentUser: PosUser | null;
  signIn: (user: PosUser) => void;
  signOut: () => void;
}

const PosContext = createContext<PosContextValue | null>(null);

export function PosProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<PosDatabase>(() => emptyDatabase());
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    let alive = true;
    loadDatabase().then((loaded) => {
      if (!alive) return;
      if (loaded) setDb({ ...emptyDatabase(), ...loaded });
      setUserId(readLocal<string>(SESSION_STORAGE_KEY));
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!ready || !dirty.current) return;
    const t = setTimeout(() => void saveDatabase(db), 120);
    return () => clearTimeout(t);
  }, [db, ready]);

  const update = useCallback((updater: (current: PosDatabase) => PosDatabase) => {
    dirty.current = true;
    setDb((current) => updater(current));
  }, []);

  const replaceAll = useCallback((next: PosDatabase) => {
    dirty.current = true;
    setDb({ ...emptyDatabase(), ...next });
  }, []);

  const signIn = useCallback((user: PosUser) => {
    writeLocal(SESSION_STORAGE_KEY, user.id);
    setUserId(user.id);
  }, []);

  const signOut = useCallback(() => {
    removeLocal(SESSION_STORAGE_KEY);
    setUserId(null);
  }, []);

  const currentUser = useMemo(
    () => db.users.find((u) => u.id === userId) ?? null,
    [db.users, userId],
  );

  const value = useMemo<PosContextValue>(
    () => ({ ready, db, update, replaceAll, currentUser, signIn, signOut }),
    [ready, db, update, replaceAll, currentUser, signIn, signOut],
  );

  return <PosContext.Provider value={value}>{children}</PosContext.Provider>;
}

export function usePos(): PosContextValue {
  const ctx = useContext(PosContext);
  if (!ctx) throw new Error("usePos harus dipakai di dalam PosProvider");
  return ctx;
}
