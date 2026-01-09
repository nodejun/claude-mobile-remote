import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { ConnectionProvider } from './src/hooks';

export default function App() {
  return (
    <ConnectionProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </ConnectionProvider>
  );
}
