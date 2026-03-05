/**
 * 테마 Context & Hook
 * 앱 전체에서 다크/라이트 모드를 공유
 *
 * useConnection과 동일한 createContext + Provider + useHook 패턴
 * StorageService와 연동하여 설정을 영구 저장
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { storageService } from '../services';
import { lightColors, darkColors, type ThemeColors } from './colors';

// ─── Context 타입 ────────────────────────────────────────

interface ThemeContextType {
  /** 현재 다크 모드 여부 */
  isDark: boolean;
  /** 현재 테마 색상 팔레트 */
  colors: ThemeColors;
  /** 다크 모드 토글 함수 */
  toggleDarkMode: () => void;
  /** 다크 모드 직접 설정 함수 */
  setDarkMode: (value: boolean) => void;
}

// ─── Context 생성 ────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType | null>(null);

// ─── Provider 컴포넌트 ──────────────────────────────────

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [isDark, setIsDark] = useState(false);

  // 앱 시작 시 저장된 설정 로드
  useEffect(() => {
    storageService.getSettings().then((settings) => {
      setIsDark(settings.darkMode);
    });
  }, []);

  // 다크 모드 토글
  const toggleDarkMode = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      storageService.saveSettings({ darkMode: next });
      return next;
    });
  }, []);

  // 다크 모드 직접 설정
  const setDarkMode = useCallback((value: boolean) => {
    setIsDark(value);
    storageService.saveSettings({ darkMode: value });
  }, []);

  // 현재 색상 팔레트 선택
  const colors = isDark ? darkColors : lightColors;

  const value: ThemeContextType = {
    isDark,
    colors,
    toggleDarkMode,
    setDarkMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
