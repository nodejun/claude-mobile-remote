import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { ConnectionProvider } from './src/hooks';
import { ThemeProvider, useTheme } from './src/theme';

/**
 * 테마에 따라 StatusBar 스타일을 동적으로 변경
 * - 다크 모드: 밝은 아이콘 (light)
 * - 라이트 모드: 어두운 아이콘 (dark)
 */
function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <ConnectionProvider>
        <ThemedStatusBar />
        <AppNavigator />
      </ConnectionProvider>
    </ThemeProvider>
  );
}
