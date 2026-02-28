import { createContext, useContext, type ReactNode } from 'react';

type RealtimeConfig = {
  url: string;
  maxReconnectAttempts: number;
};

const RealtimeContext = createContext<RealtimeConfig>({
  url: '/api/realtime',
  maxReconnectAttempts: 10,
});

type RealtimeProviderProps = {
  children: ReactNode;
  api: { url: string };
  maxReconnectAttempts?: number;
};

export function RealtimeProvider({
  children,
  api,
  maxReconnectAttempts = 10,
}: RealtimeProviderProps) {
  return (
    <RealtimeContext.Provider value={{ url: api.url, maxReconnectAttempts }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeConfig() {
  return useContext(RealtimeContext);
}
