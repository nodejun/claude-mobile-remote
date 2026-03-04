import { View } from 'react-native';
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

/**
 * 테마 배경색을 가진 루트 래퍼
 *
 * 왜 필요한가?
 * React Navigation이 화면 전환 시 잠깐 '빈 틈'이 생길 수 있는데,
 * 이때 이 루트 View의 배경색이 보이게 됨.
 * 테마에 맞는 배경색으로 설정하면 다크 모드에서 흰색 깜빡임 방지.
 *
 * 레이어 구조: 네이티브 윈도우 → ThemedRoot(여기) → NavigationContainer → Screen
 */
function ThemedRoot({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {children}
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedRoot>
        <ConnectionProvider>
          <ThemedStatusBar />
          <AppNavigator />
        </ConnectionProvider>
      </ThemedRoot>
    </ThemeProvider>
  );
}
