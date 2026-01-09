/**
 * 앱 네비게이터
 * 전체 네비게이션 구조를 정의
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import type { RootStackParamList, MainTabParamList } from './types';
import {
  ConnectionScreen,
  ChatScreen,
  FilesScreen,
  SettingsScreen,
} from '../screens';
import { useConnection } from '../hooks';

// 네비게이터 생성
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * 하단 탭 네비게이터
 * 채팅, 파일, 설정 화면을 탭으로 전환
 */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E5E5EA',
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
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <Stack.Screen name="Connection" component={ConnectionScreen} />
      )}
    </Stack.Navigator>
  );
}

/**
 * 앱 네비게이터 (최상위)
 */
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}
