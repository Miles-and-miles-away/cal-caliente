/**
 * Favorites Context — manages saved/bookmarked events.
 * Persisted to AsyncStorage under STORAGE_KEYS.FAVORITES.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "@/shared/constants";

interface FavoritesContextValue {
  /** Set of saved event IDs */
  favoriteIds: Set<number>;
  /** Toggle an event as saved/unsaved */
  toggleFavorite: (eventId: number) => void;
  /** Check if an event is saved */
  isFavorite: (eventId: number) => boolean;
  /** Total number of saved events */
  count: number;
}

const FavoritesContext = createContext<FavoritesContextValue>({
  favoriteIds: new Set(),
  toggleFavorite: () => {},
  isFavorite: () => false,
  count: 0,
});

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEYS.FAVORITES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavoriteIds(new Set(parsed.filter((id): id is number => typeof id === "number")));
          }
        }
      } catch (err) {
        console.warn("[Favorites] Failed to load:", err);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Persist whenever favorites change (after initial load)
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify([...favoriteIds])).catch((err) =>
      console.warn("[Favorites] Failed to save:", err)
    );
  }, [favoriteIds, loaded]);

  const toggleFavorite = useCallback((eventId: number) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (eventId: number) => favoriteIds.has(eventId),
    [favoriteIds]
  );

  // Memoize so consumers (every EventCard) don't re-render on unrelated parent
  // renders — only when the favorites set actually changes.
  const value = useMemo(
    () => ({
      favoriteIds,
      toggleFavorite,
      isFavorite,
      count: favoriteIds.size,
    }),
    [favoriteIds, toggleFavorite, isFavorite]
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
