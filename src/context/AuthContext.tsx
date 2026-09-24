import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  onSnapshot,
  type User 
} from '../firebase';
import type { UserProfile, ServicePermissions, ServiceKey, AccessRequest } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  logSSOEvent: (
    servicePage: string, 
    action: 'login' | 'verify_token' | 'access_granted' | 'access_denied' | 'permission_updated' | 'sync_db', 
    details?: string
  ) => Promise<void>;
  generateNewApiToken: () => Promise<string>;
  updateUserPermissions: (targetUid: string, permissions: ServicePermissions, role?: UserProfile['role']) => Promise<void>;
  requestServiceAccess: (serviceKey: ServiceKey, serviceTitle: string) => Promise<void>;
  hasPermission: (serviceKey: ServiceKey) => boolean;
}

const DEFAULT_ADMIN_EMAIL = 'lvo.lmarts@gmail.com';

const DEFAULT_ADMIN_PERMISSIONS: ServicePermissions = {
  dashboard: true,
  chat: true,
  status: true,
  support: true,
  doc: true,
};

const DEFAULT_MEMBER_PERMISSIONS: ServicePermissions = {
  dashboard: false,
  chat: false,
  status: true,
  support: false,
  doc: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = Boolean(
    user && (user.email === DEFAULT_ADMIN_EMAIL || profile?.role === 'admin')
  );

  // Sync or create user profile in Firestore
  const syncUserProfile = async (firebaseUser: User, customDisplayName?: string) => {
    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const snap = await getDoc(userRef);

      const now = new Date().toISOString();
      const isSuperAdmin = firebaseUser.email === DEFAULT_ADMIN_EMAIL;

      if (!snap.exists()) {
        const newProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          displayName: customDisplayName || firebaseUser.displayName || (firebaseUser.email ? firebaseUser.email.split('@')[0] : 'Cloud User'),
          photoURL: firebaseUser.photoURL || '',
          role: isSuperAdmin ? 'admin' : 'member',
          permissions: isSuperAdmin ? DEFAULT_ADMIN_PERMISSIONS : DEFAULT_MEMBER_PERMISSIONS,
          apiToken: 'lvo_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
          createdAt: now,
          lastLoginAt: now,
        };
        await setDoc(userRef, newProfile);
        setProfile(newProfile);
      } else {
        const existing = snap.data() as UserProfile;
        const currentRole = isSuperAdmin ? 'admin' : (existing.role || 'member');
        const currentPermissions: ServicePermissions = isSuperAdmin
          ? DEFAULT_ADMIN_PERMISSIONS
          : (existing.permissions || DEFAULT_MEMBER_PERMISSIONS);

        const updated: Partial<UserProfile> = {
          lastLoginAt: now,
          email: firebaseUser.email || existing.email,
          displayName: customDisplayName || existing.displayName || firebaseUser.displayName || 'Cloud User',
          photoURL: firebaseUser.photoURL || existing.photoURL || '',
          role: currentRole,
          permissions: currentPermissions,
        };

        if (!existing.apiToken) {
          updated.apiToken = 'lvo_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        }

        await setDoc(userRef, updated, { merge: true });
        setProfile({ ...existing, ...updated } as UserProfile);
      }

      // Log universal login SSO event
      try {
        await addDoc(collection(db, 'sso_logs'), {
          userId: firebaseUser.uid,
          userEmail: firebaseUser.email,
          servicePage: 'lvo-cloud.cloud (Central SSO Gateway)',
          action: 'login',
          timestamp: new Date().toISOString(),
          details: 'Universal SSO session authenticated across lvo-cloud cluster'
        });
      } catch (err) {
        console.warn('SSO log skipped:', err);
      }

    } catch (err) {
      console.error('Error synchronizing user profile:', err);
    }
  };

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await syncUserProfile(currentUser);

        // Listen in real-time to the current user's profile for instant permission updates
        const userRef = doc(db, 'users', currentUser.uid);
        profileUnsub = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
          }
        }, (err) => {
          console.warn('Profile listener error:', err);
        });
      } else {
        setProfile(null);
        if (profileUnsub) {
          profileUnsub();
          profileUnsub = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const signInWithGoogle = async () => {
    const cred = await signInWithPopup(auth, googleProvider);
    if (cred.user) {
      await syncUserProfile(cred.user);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await syncUserProfile(cred.user);
    }
  };

  const registerWithEmail = async (email: string, pass: string, name?: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (cred.user) {
      await syncUserProfile(cred.user, name);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  const logSSOEvent = async (
    servicePage: string, 
    action: 'login' | 'verify_token' | 'access_granted' | 'access_denied' | 'permission_updated' | 'sync_db', 
    details?: string
  ) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'sso_logs'), {
        userId: user.uid,
        userEmail: user.email,
        servicePage,
        action,
        timestamp: new Date().toISOString(),
        details: details || `Universal SSO session action: ${action}`
      });
    } catch (e) {
      console.error('Failed to write SSO log:', e);
    }
  };

  const generateNewApiToken = async (): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const newToken = 'lvo_live_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { apiToken: newToken }, { merge: true });
    setProfile(prev => prev ? { ...prev, apiToken: newToken } : null);
    return newToken;
  };

  const updateUserPermissions = async (
    targetUid: string, 
    permissions: ServicePermissions, 
    role?: UserProfile['role']
  ) => {
    if (!isAdmin) throw new Error('Permission denied. Admin credentials required.');
    const userRef = doc(db, 'users', targetUid);
    const payload: Partial<UserProfile> = { permissions };
    if (role) payload.role = role;

    await setDoc(userRef, payload, { merge: true });

    await logSSOEvent(
      'IAM Permissions Matrix',
      'permission_updated',
      `Admin updated permissions for user UID: ${targetUid}`
    );
  };

  const requestServiceAccess = async (serviceKey: ServiceKey, serviceTitle: string) => {
    if (!user) throw new Error('Sign in required');
    await addDoc(collection(db, 'access_requests'), {
      userId: user.uid,
      userEmail: user.email || '',
      userName: profile?.displayName || user.displayName || 'Cloud User',
      serviceKey,
      serviceTitle,
      status: 'pending',
      requestedAt: new Date().toISOString()
    });

    await logSSOEvent(
      serviceTitle,
      'verify_token',
      `User ${user.email} submitted access request for ${serviceKey}`
    );
  };

  const hasPermission = (serviceKey: ServiceKey): boolean => {
    if (!user) return false;
    if (user.email === DEFAULT_ADMIN_EMAIL || profile?.role === 'admin') return true;
    return Boolean(profile?.permissions?.[serviceKey]);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      isAdmin,
      signInWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
      logSSOEvent,
      generateNewApiToken,
      updateUserPermissions,
      requestServiceAccess,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
