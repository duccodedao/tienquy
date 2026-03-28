import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = ['sonlyhongduc@gmail.com', 'bmassk3@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubRole: () => void;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const email = currentUser.email || '';
        const isSuper = SUPER_ADMIN_EMAILS.includes(email);
        setIsSuperAdmin(isSuper);

        // Save user info
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          await setDoc(userRef, {
            email: currentUser.email,
            displayName: currentUser.displayName || email.split('@')[0],
            photoURL: currentUser.photoURL,
            lastLogin: Date.now()
          }, { merge: true });
        } catch (e) {
          console.error("Error saving user info:", e);
        }

        if (isSuper) {
          setIsAdmin(true);
          setLoading(false);
        } else {
          // Listen to role changes
          unsubRole = onSnapshot(userRef, 
            (docSnap) => {
              if (docSnap.exists() && docSnap.data().role === 'admin') {
                setIsAdmin(true);
              } else {
                setIsAdmin(false);
              }
              setLoading(false);
            },
            (error) => {
              console.error("Error fetching user role:", error);
              setIsAdmin(false);
              setLoading(false);
            }
          );
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
        if (unsubRole) unsubRole();
      }
    });

    return () => {
      unsubscribe();
      if (unsubRole) unsubRole();
    };
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success('Đăng nhập thành công!');
    } catch (error: any) {
      toast.error(error.message || 'Lỗi đăng nhập');
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast.success('Đăng nhập thành công!');
    } catch (error: any) {
      toast.error('Email hoặc mật khẩu không đúng');
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast.success('Đã đăng xuất');
    } catch (error: any) {
      toast.error('Lỗi đăng xuất');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isSuperAdmin, loading, loginWithGoogle, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
