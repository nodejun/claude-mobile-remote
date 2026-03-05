/**
 * 연결 상태 Context & Hook
 * 앱 전체에서 연결 상태를 공유
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { socketService, type ConnectionStatus } from '../services';

// Context 타입
interface ConnectionContextType {
  status: ConnectionStatus;
  isConnected: boolean;
}

// Context 생성
const ConnectionContext = createContext<ConnectionContextType | null>(null);

// Provider 컴포넌트
interface ConnectionProviderProps {
  children: ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    const unsubscribe = socketService.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return () => unsubscribe();
  }, []);

  const value: ConnectionContextType = {
    status,
    isConnected: status === 'connected',
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Hook
export function useConnection() {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within ConnectionProvider');
  }
  return context;
}
