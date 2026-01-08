/**
 * 파일 화면
 * PC의 파일 트리를 탐색
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function FilesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📁 파일</Text>
      <Text style={styles.subtitle}>PC 파일을 탐색하세요</Text>
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
