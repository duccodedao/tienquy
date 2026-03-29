import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signOut, User, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  adminRequested: boolean;
  isBlocked: boolean;
  blockReason: string | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SUPER_ADMIN_EMAILS = ['sonlyhongduc@gmail.com', 'bmassk3@gmail.com'];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [adminRequested, setAdminRequested] = useState(false);
  const [isAccountLocked, setIsAccountLocked] = useState(false);
  const [isIpBlocked, setIsIpBlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubIP: () => void;
    
    const checkIP = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        const userIP = data.ip;
        
        unsubIP = onSnapshot(doc(db, 'settings', 'security'), (snap) => {
          if (snap.exists()) {
            const blockedIPs = snap.data().blockedIPs || [];
            setIsIpBlocked(blockedIPs.includes(userIP));
          } else {
            setIsIpBlocked(false);
          }
        });
      } catch (e) {
        console.error("Failed to check IP", e);
      }
    };
    
    checkIP();
    
    return () => {
      if (unsubIP) unsubIP();
    }
  }, []);

  useEffect(() => {
    let unsubRole: () => void;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const email = currentUser.email || '';
        const isSuper = SUPER_ADMIN_EMAILS.includes(email);
        setIsSuperAdmin(isSuper);

        // Fetch IP
        let currentIP = '';
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          currentIP = data.ip;
        } catch (err) {
          console.error('Failed to fetch IP for logging', err);
        }

        // Save user info
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const updateData: any = {
            email: currentUser.email,
            displayName: currentUser.displayName || email.split('@')[0],
            photoURL: currentUser.photoURL,
            lastLogin: Date.now()
          };
          if (currentIP) {
            updateData.lastIP = currentIP;
          }
          await setDoc(userRef, updateData, { merge: true });
        } catch (e) {
          console.error("Error saving user info:", e);
        }

        if (isSuper) {
          setIsAdmin(true);
          setIsAccountLocked(false);
          setLoading(false);
        } else {
          // Listen to role changes
          unsubRole = onSnapshot(userRef, 
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data();
                setIsAdmin(data.role === 'admin');
                setAdminRequested(data.adminRequested === true);
                setIsAccountLocked(data.isLocked === true);
              } else {
                setIsAdmin(false);
                setAdminRequested(false);
                setIsAccountLocked(false);
              }
              setLoading(false);
            },
            (error) => {
              console.error("Error fetching user role:", error);
              setIsAdmin(false);
              setIsAccountLocked(false);
              setLoading(false);
            }
          );
        }
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setAdminRequested(false);
        setIsAccountLocked(false);
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

  const registerWithEmail = async (email: string, pass: string, displayName: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const user = userCredential.user;
      
      // Update profile with display name and random avatar
      const randomAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(displayName || email)}`;
      await updateProfile(user, {
        displayName: displayName || email.split('@')[0],
        photoURL: randomAvatar
      });

      // Save user info to Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        email: user.email,
        displayName: displayName || email.split('@')[0],
        photoURL: randomAvatar,
        lastLogin: Date.now(),
        role: 'user' // Default role
      }, { merge: true });

      toast.success('Đăng ký thành công!');
    } catch (error: any) {
      console.error('Registration error:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email này đã được sử dụng');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Mật khẩu quá yếu (ít nhất 6 ký tự)');
      } else {
        toast.error('Lỗi đăng ký: ' + error.message);
      }
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

  const isBlocked = isIpBlocked || isAccountLocked;
  const blockReason = isIpBlocked 
    ? 'Địa chỉ IP của bạn đã bị chặn truy cập vào hệ thống.' 
    : (isAccountLocked ? 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' : null);

  return (
    <AuthContext.Provider value={{ user, isAdmin, isSuperAdmin, adminRequested, isBlocked, blockReason, loading, loginWithGoogle, loginWithEmail, registerWithEmail, logout }}>
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
