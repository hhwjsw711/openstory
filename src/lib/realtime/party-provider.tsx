import { createContext, useContext } from 'react';

type PartyKitContextValue = {
  host: string;
};

const PartyKitContext = createContext<PartyKitContextValue | null>(null);

export function usePartyKitHost(): string {
  const ctx = useContext(PartyKitContext);
  if (!ctx)
    throw new Error('usePartyKitHost must be used within <PartyKitProvider>');
  return ctx.host;
}

type PartyKitProviderProps = {
  host: string;
  children: React.ReactNode;
};

export function PartyKitProvider({ host, children }: PartyKitProviderProps) {
  return <PartyKitContext value={{ host }}>{children}</PartyKitContext>;
}
