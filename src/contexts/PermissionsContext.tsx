import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

interface RolePermissions {
  canViewDashboard: boolean;
  canViewFunds: boolean;
  canViewHistory: boolean;
  canViewReports: boolean;
  canViewSettings: boolean;
  canAddTransaction: boolean;
  canEditTransaction: boolean;
  canDeleteTransaction: boolean;
  canManageAdmins: boolean;
  canManageIPs: boolean;
  canExportData: boolean;
  canImportData: boolean;
  canManageFunds: boolean;
  canManageNotes: boolean;
  canRecalculateBalances: boolean;
  canManageNotifications: boolean;
}

interface Permissions {
  user: RolePermissions;
  admin: RolePermissions;
}

const defaultPermissions: Permissions = {
  user: {
    canViewDashboard: true,
    canViewFunds: true,
    canViewHistory: true,
    canViewReports: true,
    canViewSettings: true,
    canAddTransaction: false,
    canEditTransaction: false,
    canDeleteTransaction: false,
    canManageAdmins: false,
    canManageIPs: false,
    canExportData: false,
    canImportData: false,
    canManageFunds: false,
    canManageNotes: false,
    canRecalculateBalances: false,
    canManageNotifications: false,
  },
  admin: {
    canViewDashboard: true,
    canViewFunds: true,
    canViewHistory: true,
    canViewReports: true,
    canViewSettings: true,
    canAddTransaction: true,
    canEditTransaction: true,
    canDeleteTransaction: true,
    canManageAdmins: false,
    canManageIPs: false,
    canExportData: true,
    canImportData: true,
    canManageFunds: true,
    canManageNotes: true,
    canRecalculateBalances: true,
    canManageNotifications: true,
  }
};

interface PermissionsContextType {
  permissions: Permissions;
  updatePermissions: (newPermissions: Permissions) => Promise<void>;
  can: (action: keyof RolePermissions) => boolean;
  loading: boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export const PermissionsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin, isSuperAdmin } = useAuth();
  const [permissions, setPermissions] = useState<Permissions>(defaultPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'permissions'), (snap) => {
      if (snap.exists()) {
        setPermissions(snap.data() as Permissions);
      } else {
        // Initialize with defaults if not exists
        setDoc(doc(db, 'settings', 'permissions'), defaultPermissions);
      }
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const updatePermissions = async (newPermissions: Permissions) => {
    await setDoc(doc(db, 'settings', 'permissions'), newPermissions);
  };

  const can = (action: keyof RolePermissions): boolean => {
    if (isSuperAdmin) return true;
    if (isAdmin) return permissions.admin[action];
    return permissions.user[action];
  };

  return (
    <PermissionsContext.Provider value={{ permissions, updatePermissions, can, loading }}>
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};
