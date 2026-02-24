import { createContext, useContext } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextValue {
  user: FirebaseUser | null;
  isSuperAdmin: boolean;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isSuperAdmin: false,
  loading: true,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
