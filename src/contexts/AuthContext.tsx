import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User, UserRole } from '@/types';
import { getCurrentUser, setCurrentUser, getUsers, initializeDemoData } from '@/lib/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string) => Promise<boolean>;
  logout: () => void;
  switchRole: (role: UserRole) => void; // Demo feature to test different roles
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize demo data on first load
    initializeDemoData();
    
    // Check for existing session
    const storedUser = getCurrentUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string): Promise<boolean> => {
    // Simulate magic link verification
    const users = getUsers();
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.active);
    
    if (foundUser) {
      // Update last login
      foundUser.lastLoginAt = new Date().toISOString();
      setUser(foundUser);
      setCurrentUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setCurrentUser(null);
  };

  // Demo feature: switch between roles to test UI
  const switchRole = (role: UserRole) => {
    const users = getUsers();
    const userWithRole = users.find(u => u.role === role && u.active);
    if (userWithRole) {
      setUser(userWithRole);
      setCurrentUser(userWithRole);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
