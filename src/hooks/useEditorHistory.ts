/**
 * Editor History Hook
 * Implements undo/redo functionality for page builder
 */

import { useState, useCallback } from 'react';

const MAX_HISTORY = 50; // Keep last 50 states

export function useEditorHistory<T>() {
  const [history, setHistory] = useState<T[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const currentState = currentIndex >= 0 ? history[currentIndex] : null;
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const pushState = useCallback((state: T) => {
    setHistory(prev => {
      // Remove any states after current index (when undoing then making new changes)
      const newHistory = prev.slice(0, currentIndex + 1);
      
      // Add new state
      newHistory.push(state);
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
        setCurrentIndex(MAX_HISTORY - 1);
      } else {
        setCurrentIndex(newHistory.length - 1);
      }
      
      return newHistory;
    });
  }, [currentIndex]);

  const undo = useCallback((): T | null => {
    if (!canUndo) return null;
    
    const newIndex = currentIndex - 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [canUndo, currentIndex, history]);

  const redo = useCallback((): T | null => {
    if (!canRedo) return null;
    
    const newIndex = currentIndex + 1;
    setCurrentIndex(newIndex);
    return history[newIndex];
  }, [canRedo, currentIndex, history]);

  const clear = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
  }, []);

  return {
    currentState,
    canUndo,
    canRedo,
    pushState,
    undo,
    redo,
    clear,
  };
}

