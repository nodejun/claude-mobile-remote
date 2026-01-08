/**
 * 연결 화면
 * PC Agent와 WebSocket 연결을 관리
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ConnectionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔗 연결</Text>
      <Text style={styles.subtitle}>PC Agent와 연결하세요</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
