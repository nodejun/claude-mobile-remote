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
import { Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

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
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBarBackground,
          borderTopColor: colors.tabBarBorder,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingTop: 6,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: colors.shadowOpacity,
          shadowRadius: 8,
          elevation: 8,
        },
      }}
    >
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarLabel: '채팅',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Files"
        component={FilesScreen}
        options={{
          tabBarLabel: '파일',
          tabBarIcon: ({ color, size }) => (
            <Feather name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Changes"
        component={ChangesScreen}
        options={{
          tabBarLabel: '변경',
          tabBarIcon: ({ color, size }) => (
            <Feather name="git-commit" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarLabel: '설정',
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * 루트 스택 네비게이터
 * 연결 상태에 따라 화면 전환
 *
 * 깜빡임 방지 전략:
 * 1. screenOptions.contentStyle → 모든 스택 화면의 기본 배경색을 테마에 맞게 설정
 *    (네이티브 컨테이너 뷰에 즉시 적용되어, React 렌더링 전에 올바른 배경이 보임)
 * 2. FileViewer → 코드 에디터라 항상 다크(#1e1e1e)로 고정
 * 3. ChangeDetail → 테마 배경과 동일하게 설정 (colors.background)
 * 4. animation: 'fade' → 슬라이드 대신 페이드로 중간 빈 틈 최소화
 */
function RootNavigator() {
  const { isConnected } = useConnection();
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {isConnected ? (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="FileViewer"
            component={FileViewerScreen}
            options={{
              contentStyle: { backgroundColor: '#1e1e1e' },
              animation: 'fade',
            }}
          />
          <Stack.Screen
            name="ChangeDetail"
            component={ChangeDetailScreen}
            options={{
              contentStyle: { backgroundColor: colors.background },
              animation: 'fade',
            }}
          />
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
