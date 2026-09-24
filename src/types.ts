export type ServiceKey = 'dashboard' | 'chat' | 'status' | 'support' | 'doc';

export interface ServicePermissions {
  dashboard: boolean;
  chat: boolean;
  status: boolean;
  support: boolean;
  doc: boolean;
}

export interface CloudPage {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: 'dashboard' | 'docs' | 'support' | 'chat' | 'status' | 'portal';
  githubRepo: string; // e.g. "lvoholdings00-sys/LVO-Dashboard"
  githubBranch: string; // e.g. "main"
  subdomain: string; // e.g. "dashboard.lvo-cloud.cloud"
  deploymentUrl: string; // Live production URL
  serviceKey: ServiceKey; // Identifies which permission flag governs this
  ssoStatus: 'active' | 'syncing' | 'pending';
  authScope: 'public' | 'authenticated' | 'admin_only';
  ownerUid?: string;
  ownerEmail?: string;
  createdAt?: string;
  iconName?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'admin' | 'developer' | 'member' | 'suspended';
  permissions: ServicePermissions;
  githubUsername?: string;
  apiToken?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

export interface AccessRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  serviceKey: ServiceKey;
  serviceTitle: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
}

export interface DatabaseEntry {
  id: string;
  pageId: string;
  pageTitle?: string;
  collection: string;
  payload: Record<string, any>;
  authorUid: string;
  authorEmail: string;
  createdAt: any;
}

export interface SSOLog {
  id: string;
  userId: string;
  userEmail: string;
  servicePage: string;
  action: 'login' | 'verify_token' | 'access_granted' | 'access_denied' | 'permission_updated' | 'sync_db';
  timestamp: any;
  status?: 'success' | 'denied' | 'pending' | string;
  service?: string;
  ip?: string;
  details?: string;
}
