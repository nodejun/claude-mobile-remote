/**
 * 앱 네비게이터
 * 전체 네비게이션 구조를 정의
 * 테마(다크/라이트)에 따라 탭바 및 네비게이션 색상 자동 전환
 */
import React from 'react';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import type { RootStackParamList, MainTabParamList } from './types';
import {
  ConnectionScreen,
  ChatScreen,
  FilesScreen,
  ChangesScreen,
  ChangeDetailScreen,
  SettingsScreen,
  FileViewerScreen,
} from '../screens';
import { useConnection } from '../hooks';
import { useTheme } from '../theme';

// 네비게이터 생성
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * 하단 탭 네비게이터
 * 채팅, 파일, 설정 화면을 탭으로 전환
 * 테마 색상을 동적으로 적용
 */
function MainTabs() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
        },
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: '채팅',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>💬</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Files"
        component={FilesScreen}
        options={{
          tabBarLabel: '파일',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📁</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Changes"
        component={ChangesScreen}
        options={{
          tabBarLabel: '변경',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>📝</Text>
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: () => (
            <Text style={{ fontSize: 20 }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * 루트 스택 네비게이터
 * 연결 상태에 따라 화면 전환
 */
function RootNavigator() {
  const { isConnected } = useConnection();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isConnected ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="FileViewer" component={FileViewerScreen} />
          <Stack.Screen name="ChangeDetail" component={ChangeDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Connection" component={ConnectionScreen} />
      )}
    </Stack.Navigator>
  );
}

/**
 * 앱 네비게이터 (최상위)
 * React Navigation 테마를 다크/라이트에 맞게 설정
 */
export default function AppNavigator() {
  const { colors, isDark } = useTheme();

  // React Navigation 테마 구성
  const navigationTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          primary: colors.primary,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          primary: colors.primary,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootNavigator />
    </NavigationContainer>
  );
}
