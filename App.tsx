/**
 * 앱 진입점
 * 네비게이터를 렌더링
 */
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';

export default function App() {
  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator />
    </>
  );
}
