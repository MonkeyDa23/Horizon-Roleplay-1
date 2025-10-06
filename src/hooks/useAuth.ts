import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import type { User, AuthContextType } from '../types';

// Define a new AuthContextType that includes the updateUser function for external use
interface AppAuthContextType extends AuthContextType {
  updateUser: (user: User) => void;
}

export const useAuth = (): AppAuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context as AppAuthContextType;
};