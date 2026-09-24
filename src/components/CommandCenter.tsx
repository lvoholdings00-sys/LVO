import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy, limit } from '../firebase';
import type { UserProfile, ServicePermissions, ServiceKey, SSOLog } from '../types';

export interface DivisionConfig {
  key: string;
  name: string;
  kind: 'standard' | 'chat';
  workerDiv?: string;
  accent: string;
  accentDim: string;
  light?: boolean;
}

export interface UniversalAppConfig {
  key: ServiceKey;
  name: string;
  githubRepo: string;
  githubUrl: string;
  subdomain: string;
  description: string;
  icon: string;
  accent: string;
}

export const UNIVERSAL_APPS: UniversalAppConfig[] = [
  {
    key: 'dashboard',
    name: 'LVO-Dashboard',
    githubRepo: 'lvoholdings00-sys/LVO-Dashboard',
    githubUrl: 'https://github.com/lvoholdings00-sys/LVO-Dashboard',
    subdomain: 'dashboard.lvo-cloud.cloud',
    description: 'Executive KPI analytics, financial liquidity metrics, and cross-subsidiary overview.',
    icon: '📊',
    accent: '#C8A96E'
  },
  {
    key: 'chat',
    name: 'ChatLVO',
    githubRepo: 'lvoholdings00-sys/chatlvo',
    githubUrl: 'https://github.com/lvoholdings00-sys/chatlvo',
    subdomain: 'chat.lvo-cloud.cloud',
    description: 'High-security internal communication, private channels, and direct messaging network.',
    icon: '💬',
    accent: '#4A90D9'
  },
  {
    key: 'status',
    name: 'Status',
    githubRepo: 'lvoholdings00-sys/Status',
    githubUrl: 'https://github.com/lvoholdings00-sys/Status',
    subdomain: 'status.lvo-cloud.cloud',
    description: 'Global node infrastructure health, edge ingress availability, and live cluster uptime.',
    icon: '🟢',
    accent: '#1D9E75'
  },
  {
    key: 'support',
    name: 'Support',
    githubRepo: 'lvoholdings00-sys/support',
    githubUrl: 'https://github.com/lvoholdings00-sys/support',
    subdomain: 'support.lvo-cloud.cloud',
    description: 'Enterprise ticket dispatch, partner incident routing, and SLA resolution tracking.',
    icon: '🎧',
    accent: '#7F77DD'
  },
  {
    key: 'doc',
    name: 'Documentation',
    githubRepo: 'lvoholdings00-sys/doc',
    githubUrl: 'https://github.com/lvoholdings00-sys/doc',
    subdomain: 'docs.lvo-cloud.cloud',
    description: 'Architectural specifications, IAM security standards, and API developer references.',
    icon: '📑',
    accent: '#D97706'
  }
];

export const CLUSTER_VIEWS = [
  { key: 'iam', name: 'Universal IAM & Permissions', icon: '🛡', accent: '#C8A96E', accentDim: '#8a7238' },
  { key: 'apps', name: 'Cloud Apps & Repositories', icon: '🌐', accent: '#4A90D9', accentDim: '#2f5c8a' },
  { key: 'logs', name: 'Cluster SSO Logs', icon: '📋', accent: '#1D9E75', accentDim: '#146e53' }
];

export const DIVISIONS: DivisionConfig[] = [
  { key: 'alliance', name: 'Alliance', kind: 'standard', workerDiv: 'Alliance', accent: '#7F77DD', accentDim: '#5f58a8' },
  { key: 'vindex', name: 'Vindex', kind: 'standard', workerDiv: 'Vindex', accent: '#C8A96E', accentDim: '#8a7238' },
  { key: 'ops', name: 'Operations', kind: 'standard', workerDiv: 'Ops', accent: '#1D9E75', accentDim: '#146e53' },
  { key: 'careers', name: 'Careers', kind: 'standard', workerDiv: 'Careers', accent: '#2A2A2E', accentDim: '#5c5b58', light: true },
  { key: 'chat', name: 'Chat', kind: 'chat', accent: '#4A90D9', accentDim: '#2f5c8a' }
];

export const TIER_LABELS: Record<number, string> = {
  1: 'Tier I — Principal',
  2: 'Tier II — Associate',
  3: 'Tier III — Partner',
  4: 'Tier IV — Member'
};

interface MemberItem {
  uid: string;
  name: string;
  email: string;
  tier: number;
  role: 'member' | 'admin';
}

interface MailItem {
  id: string;
  direction: 'inbound' | 'outbound';
  from_addr: string;
  to_addr: string;
  subject: string;
  created_at: string;
}

interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  division: string;
}

interface ActivityItem {
  id: string;
  action: string;
  actor: string;
  time: string;
  is_admin_action: boolean;
}

interface ChatUser {
  id: string;
  displayName: string;
  role: 'member' | 'admin';
  mustChangePassword?: boolean;
}

interface ChatChannelMember {
  id: string;
  displayName: string;
  canPost?: boolean;
}

interface ChatChannel {
  id: string;
  name: string;
  type: 'group' | 'announcement';
  memberCount: number;
  messageCount: number;
  lastActivity: string;
  members: ChatChannelMember[];
}

interface DmThread {
  id: string;
  userA: { id: string; displayName: string };
  userB: { id: string; displayName: string };
  lastActivity: string;
}

interface CommandCenterProps {
  onBackToMenu: () => void;
}

export const CommandCenter: React.FC<CommandCenterProps> = ({ onBackToMenu }) => {
  const { user: authUser, profile: authProfile, isAdmin, logout, updateUserPermissions, hasPermission, logSSOEvent } = useAuth();

  const [activeDivKey, setActiveDivKey] = useState<string>('iam');
  const [activeTab, setActiveTab] = useState<string>('team');
  const [expandedChannelId, setExpandedChannelId] = useState<string | null>(null);

  // Real-time Firestore state
  const [realUsers, setRealUsers] = useState<UserProfile[]>([]);
  const [realSSOLogs, setRealSSOLogs] = useState<SSOLog[]>([]);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Add User Modal State
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUniversalEmail, setNewUniversalEmail] = useState('');
  const [newUniversalName, setNewUniversalName] = useState('');
  const [newUniversalRole, setNewUniversalRole] = useState<UserProfile['role']>('member');
  const [newUniversalPerms, setNewUniversalPerms] = useState<ServicePermissions>({
    dashboard: true,
    chat: true,
    status: true,
    support: false,
    doc: true
  });

  // Subscribe in real-time to Firestore users collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((d) => {
        list.push({ uid: d.id, ...d.data() } as UserProfile);
      });
      setRealUsers(list);
    }, (err) => {
      console.warn('Realtime users sync error:', err);
    });
    return () => unsub();
  }, []);

  // Subscribe in real-time to Firestore sso_logs collection
  useEffect(() => {
    try {
      const q = query(collection(db, 'sso_logs'), orderBy('timestamp', 'desc'), limit(25));
      const unsub = onSnapshot(q, (snap) => {
        const logs: SSOLog[] = [];
        snap.forEach((d) => {
          logs.push({ id: d.id, ...d.data() } as SSOLog);
        });
        setRealSSOLogs(logs);
      }, (err) => {
        console.warn('Realtime sso_logs sync warning:', err);
      });
      return () => unsub();
    } catch (_) {}
  }, []);

  const handleTogglePermission = async (targetUid: string, serviceKey: ServiceKey) => {
    const targetUser = realUsers.find((u) => u.uid === targetUid);
    if (!targetUser) return;
    const currentVal = !!targetUser.permissions?.[serviceKey];
    const updatedPermissions = {
      ...(targetUser.permissions || {
        dashboard: false,
        chat: false,
        status: false,
        support: false,
        doc: false
      }),
      [serviceKey]: !currentVal
    };

    try {
      await updateUserPermissions(targetUid, updatedPermissions);
      setStatusFeedback(`Permission for [${serviceKey.toUpperCase()}] updated for ${targetUser.email}`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error updating permissions: ${err.message}`);
    }
  };

  const handleUpdateRole = async (targetUid: string, newRole: UserProfile['role']) => {
    try {
      await setDoc(doc(db, 'users', targetUid), { role: newRole }, { merge: true });
      setStatusFeedback(`Updated role to ${newRole.toUpperCase()} for user`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error updating role: ${err.message}`);
    }
  };

  const handleDeleteUser = async (targetUid: string, email: string) => {
    if (!confirm(`Are you sure you want to remove user ${email} from Universal Directory?`)) return;
    try {
      await deleteDoc(doc(db, 'users', targetUid));
      setStatusFeedback(`User ${email} removed from Universal Directory`);
      setTimeout(() => setStatusFeedback(null), 3000);
    } catch (err: any) {
      alert(`Error deleting user: ${err.message}`);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUniversalEmail.trim()) return;
    const generatedUid = 'usr_' + Math.random().toString(36).substring(2, 9);
    const newProf: UserProfile = {
      uid: generatedUid,
      email: newUniversalEmail.trim().toLowerCase(),
      displayName: newUniversalName.trim() || newUniversalEmail.split('@')[0],
      role: newUniversalRole,
      permissions: newUniversalPerms,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'users', generatedUid), newProf);
      setShowAddUserModal(false);
      setNewUniversalEmail('');
      setNewUniversalName('');
      setStatusFeedback(`Created user account for ${newProf.email}`);
      setTimeout(() => setStatusFeedback(null), 3500);
    } catch (err: any) {
      alert(`Error creating user: ${err.message}`);
    }
  };

  // Auth & Session state per division
  const [linkedDivs, setLinkedDivs] = useState<Record<string, boolean>>({
    alliance: true,
    vindex: true,
    ops: true,
    careers: true,
    chat: true
  });

  const [usersByDiv, setUsersByDiv] = useState<Record<string, any>>({
    alliance: { firstName: 'LVO', lastName: 'Administrator', email: 'admin@alliance.lvo-cloud.cloud', role: 'admin', tier: 1 },
    vindex: { firstName: 'LVO', lastName: 'Administrator', email: 'admin@vindex.lvo-cloud.cloud', role: 'admin', tier: 1 },
    ops: { firstName: 'Operations', lastName: 'Director', email: 'ops@lvo-cloud.cloud', role: 'admin', tier: 1 },
    careers: { firstName: 'Talent', lastName: 'Partner', email: 'careers@lvo-cloud.cloud', role: 'admin', tier: 1 },
    chat: { firstName: 'LVO Central', lastName: '', email: 'admin@chat.lvo-cloud.cloud', role: 'admin', id: 'lvo_admin' }
  });

  // Standard Division Data
  const [membersByDiv, setMembersByDiv] = useState<Record<string, MemberItem[]>>({
    alliance: [
      { uid: 'm1', name: 'Alexander Vance', email: 'avance@alliance.lvo-cloud.cloud', tier: 1, role: 'admin' },
      { uid: 'm2', name: 'Elena Rostova', email: 'erostova@alliance.lvo-cloud.cloud', tier: 2, role: 'member' },
      { uid: 'm3', name: 'Julian Drake', email: 'jdrake@alliance.lvo-cloud.cloud', tier: 3, role: 'member' }
    ],
    vindex: [
      { uid: 'v1', name: 'Marcus Sterling', email: 'msterling@vindex.lvo-cloud.cloud', tier: 1, role: 'admin' },
      { uid: 'v2', name: 'Clara Oswald', email: 'coswald@vindex.lvo-cloud.cloud', tier: 2, role: 'member' }
    ],
    ops: [
      { uid: 'o1', name: 'David Mercer', email: 'dmercer@ops.lvo-cloud.cloud', tier: 1, role: 'admin' },
      { uid: 'o2', name: 'Sarah Lin', email: 'slin@ops.lvo-cloud.cloud', tier: 4, role: 'member' }
    ],
    careers: [
      { uid: 'c1', name: 'Rachel Hayes', email: 'rhayes@careers.lvo-cloud.cloud', tier: 1, role: 'admin' },
      { uid: 'c2', name: 'Brian Torres', email: 'btorres@careers.lvo-cloud.cloud', tier: 3, role: 'member' }
    ]
  });

  const [mailByDiv, setMailByDiv] = useState<Record<string, MailItem[]>>({
    alliance: [
      { id: 'ml1', direction: 'inbound', from_addr: 'compliance@gov-sec.org', to_addr: 'admin@alliance.lvo-cloud.cloud', subject: 'Q3 Sovereign Clearance Verification', created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
      { id: 'ml2', direction: 'outbound', from_addr: 'admin@alliance.lvo-cloud.cloud', to_addr: 'partners@vindex.lvo-cloud.cloud', subject: 'Synchronized Node Infrastructure Deploy', created_at: new Date(Date.now() - 3600000 * 26).toISOString() }
    ],
    vindex: [
      { id: 'ml3', direction: 'inbound', from_addr: 'audit@vindex-holdings.ch', to_addr: 'vault@vindex.lvo-cloud.cloud', subject: 'Custody Reserve Attestation Receipt', created_at: new Date(Date.now() - 3600000 * 12).toISOString() }
    ],
    ops: [
      { id: 'ml4', direction: 'inbound', from_addr: 'alerts@ops.lvo-cloud.cloud', to_addr: 'noc@ops.lvo-cloud.cloud', subject: 'Edge Gateway BGP Health Nominal', created_at: new Date(Date.now() - 3600000 * 2).toISOString() }
    ],
    careers: [
      { id: 'ml5', direction: 'inbound', from_addr: 'applicant.77@stanford.edu', to_addr: 'careers@lvo-cloud.cloud', subject: 'Principal Cryptographic Engineer Application', created_at: new Date(Date.now() - 3600000 * 18).toISOString() }
    ]
  });

  const [announcementsByDiv, setAnnouncementsByDiv] = useState<Record<string, AnnouncementItem[]>>({
    alliance: [
      { id: 'a1', title: 'Global SSO Protocol Upgrade 2.4', body: 'All subsidiary clusters now require multi-tenant token assertion across lvo-cloud.cloud ingress controllers.', pinned: true, division: 'Alliance' },
      { id: 'a2', title: 'Quarterly Board Briefing Schedule', body: 'Executive principals convene on Friday 14:00 UTC in Secure Channel Alpha.', pinned: false, division: 'Alliance' }
    ],
    vindex: [
      { id: 'a3', title: 'Vindex Asset Partition Complete', body: 'Cold-storage vaults transitioned to multi-signature cryptographic isolation.', pinned: true, division: 'Vindex' }
    ],
    ops: [
      { id: 'a4', title: 'Zero-Downtime Infrastructure Migration', body: 'Load balancers routing all GitHub Pages through primary high-availability ingress.', pinned: true, division: 'Ops' }
    ],
    careers: [
      { id: 'a5', title: 'Senior Advisory Board Openings', body: 'Accepting tier-one partner nominations for the 2026 executive committee.', pinned: true, division: 'Careers' }
    ]
  });

  const [activityByDiv, setActivityByDiv] = useState<Record<string, ActivityItem[]>>({
    alliance: [
      { id: 'act1', action: 'Member Elena Rostova elevated to Tier II', actor: 'Alexander Vance', time: new Date(Date.now() - 3600000 * 3).toISOString(), is_admin_action: true },
      { id: 'act2', action: 'API Session Token Revoked for node-eu-west', actor: 'System Daemon', time: new Date(Date.now() - 3600000 * 15).toISOString(), is_admin_action: true },
      { id: 'act3', action: 'Inbound transmission decrypted & archived', actor: 'Mail Router', time: new Date(Date.now() - 3600000 * 28).toISOString(), is_admin_action: false }
    ],
    vindex: [
      { id: 'act4', action: 'Treasury signature validated', actor: 'Marcus Sterling', time: new Date(Date.now() - 3600000 * 8).toISOString(), is_admin_action: true }
    ],
    ops: [
      { id: 'act5', action: 'BGP edge routing re-balanced', actor: 'David Mercer', time: new Date(Date.now() - 3600000 * 1).toISOString(), is_admin_action: true }
    ],
    careers: [
      { id: 'act6', action: 'New applicant candidate dossier generated', actor: 'HR Automation', time: new Date(Date.now() - 3600000 * 14).toISOString(), is_admin_action: false }
    ]
  });

  // Chat Data
  const [chatUsers, setChatUsers] = useState<ChatUser[]>([
    { id: 'lvo_admin', displayName: 'LVO Administrator', role: 'admin' },
    { id: 'a_vance', displayName: 'Alexander Vance', role: 'member' },
    { id: 'e_rostova', displayName: 'Elena Rostova', role: 'member' },
    { id: 'm_sterling', displayName: 'Marcus Sterling', role: 'member' },
    { id: 's_lin', displayName: 'Sarah Lin', role: 'member' }
  ]);

  const [chatChannels, setChatChannels] = useState<ChatChannel[]>([
    {
      id: 'general',
      name: 'general',
      type: 'group',
      memberCount: 5,
      messageCount: 142,
      lastActivity: new Date(Date.now() - 60000 * 12).toISOString(),
      members: [
        { id: 'lvo_admin', displayName: 'LVO Administrator', canPost: true },
        { id: 'a_vance', displayName: 'Alexander Vance', canPost: true },
        { id: 'e_rostova', displayName: 'Elena Rostova', canPost: true },
        { id: 'm_sterling', displayName: 'Marcus Sterling', canPost: true },
        { id: 's_lin', displayName: 'Sarah Lin', canPost: true }
      ]
    },
    {
      id: 'briefings',
      name: 'executive-briefings',
      type: 'announcement',
      memberCount: 3,
      messageCount: 19,
      lastActivity: new Date(Date.now() - 3600000 * 5).toISOString(),
      members: [
        { id: 'lvo_admin', displayName: 'LVO Administrator', canPost: true },
        { id: 'a_vance', displayName: 'Alexander Vance', canPost: false },
        { id: 'm_sterling', displayName: 'Marcus Sterling', canPost: false }
      ]
    },
    {
      id: 'ops-feed',
      name: 'cluster-telemetry',
      type: 'group',
      memberCount: 2,
      messageCount: 88,
      lastActivity: new Date(Date.now() - 60000 * 45).toISOString(),
      members: [
        { id: 'lvo_admin', displayName: 'LVO Administrator', canPost: true },
        { id: 's_lin', displayName: 'Sarah Lin', canPost: true }
      ]
    }
  ]);

  const [dmThreads, setDmThreads] = useState<DmThread[]>([
    {
      id: 'dm1',
      userA: { id: 'lvo_admin', displayName: 'LVO Administrator' },
      userB: { id: 'a_vance', displayName: 'Alexander Vance' },
      lastActivity: new Date(Date.now() - 60000 * 30).toISOString()
    },
    {
      id: 'dm2',
      userA: { id: 'lvo_admin', displayName: 'LVO Administrator' },
      userB: { id: 'm_sterling', displayName: 'Marcus Sterling' },
      lastActivity: new Date(Date.now() - 3600000 * 7).toISOString()
    }
  ]);

  // Form states
  const [newMemberFirst, setNewMemberFirst] = useState('');
  const [newMemberLast, setNewMemberLast] = useState('');
  const [newMemberUser, setNewMemberUser] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberTier, setNewMemberTier] = useState<number>(4);
  const [newMemberRole, setNewMemberRole] = useState<'member' | 'admin'>('member');
  const [memberFormErr, setMemberFormErr] = useState('');

  const [mailTo, setMailTo] = useState('');
  const [mailSubj, setMailSubj] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailErr, setMailErr] = useState('');

  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annErr, setAnnErr] = useState('');

  const [chatNewUser, setChatNewUser] = useState('');
  const [chatNewName, setChatNewName] = useState('');
  const [chatNewPw, setChatNewPw] = useState('');
  const [chatNewRole, setChatNewRole] = useState<'member' | 'admin'>('member');
  const [chatUserErr, setChatUserErr] = useState('');

  const [channelNewName, setChannelNewName] = useState('');
  const [channelNewType, setChannelNewType] = useState<'group' | 'announcement'>('group');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [channelErr, setChannelErr] = useState('');

  // Division sign in states
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [pendingCode, setPendingCode] = useState(false);
  const [codeVal, setCodeVal] = useState('');

  const isClusterView = activeDivKey === 'iam' || activeDivKey === 'apps' || activeDivKey === 'logs';
  const curCluster = CLUSTER_VIEWS.find((c) => c.key === activeDivKey);
  const curDiv = DIVISIONS.find((d) => d.key === activeDivKey) || DIVISIONS[0];
  const isCurLinked = isClusterView ? true : !!linkedDivs[activeDivKey];
  const curUser = usersByDiv[activeDivKey];

  // Dynamic Theme Application
  const isLight = !isClusterView && curDiv.light;
  const theme = isLight
    ? {
        bg: '#f6f5f1',
        bgRaised: '#ffffff',
        line: '#e2e0d8',
        lineSoft: '#ecece6',
        ink: '#1c1b18',
        inkDim: '#726f68',
        inkFaint: '#a7a49c',
        btnText: '#f6f5f1'
      }
    : {
        bg: '#0a0a0c',
        bgRaised: '#111114',
        line: '#242327',
        lineSoft: '#1a1a1d',
        ink: '#eae7e0',
        inkDim: '#8b8a86',
        inkFaint: '#5c5b58',
        btnText: '#0a0a0c'
      };

  const accentColor = isClusterView && curCluster ? curCluster.accent : curDiv.accent;
  const accentDim = isClusterView && curCluster ? curCluster.accentDim : curDiv.accentDim;

  // Actions
  const handleSwitchDiv = (key: string) => {
    setActiveDivKey(key);
    setActiveTab('team');
    setExpandedChannelId(null);
    setPendingCode(false);
    setLoginErr('');
  };

  const handleSignOut = () => {
    setLinkedDivs((prev) => ({ ...prev, [activeDivKey]: false }));
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPw) {
      setLoginErr('Identifier and password are required');
      return;
    }
    if (curDiv.kind === 'chat') {
      setLinkedDivs((prev) => ({ ...prev, chat: true }));
      setLoginErr('');
      setLoginId('');
      setLoginPw('');
    } else {
      setPendingCode(true);
      setLoginErr('');
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeVal.length !== 6) {
      setLoginErr('Enter 6-digit code');
      return;
    }
    setLinkedDivs((prev) => ({ ...prev, [activeDivKey]: true }));
    setPendingCode(false);
    setLoginId('');
    setLoginPw('');
    setCodeVal('');
    setLoginErr('');
  };

  // Member Handlers
  const handleSaveMember = (uid: string, tier: number, role: 'member' | 'admin') => {
    setMembersByDiv((prev) => {
      const list = prev[activeDivKey] || [];
      return {
        ...prev,
        [activeDivKey]: list.map((m) => (m.uid === uid ? { ...m, tier, role } : m))
      };
    });
  };

  const handleRemoveMember = (uid: string) => {
    if (!confirm('Remove this member?')) return;
    setMembersByDiv((prev) => ({
      ...prev,
      [activeDivKey]: (prev[activeDivKey] || []).filter((m) => m.uid !== uid)
    }));
  };

  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    setMemberFormErr('');
    if (!newMemberFirst || !newMemberLast || !newMemberUser || !newMemberEmail) {
      setMemberFormErr('First name, last name, username, and email are all required.');
      return;
    }

    const newItem: MemberItem = {
      uid: 'm_' + Math.random().toString(36).substring(2, 7),
      name: `${newMemberFirst.trim()} ${newMemberLast.trim()}`,
      email: newMemberEmail.trim(),
      tier: newMemberTier,
      role: newMemberRole
    };

    setMembersByDiv((prev) => ({
      ...prev,
      [activeDivKey]: [...(prev[activeDivKey] || []), newItem]
    }));

    // Add activity
    setActivityByDiv((prev) => ({
      ...prev,
      [activeDivKey]: [
        {
          id: 'act_' + Date.now(),
          action: `Created member ${newItem.name} (${TIER_LABELS[newItem.tier]})`,
          actor: curUser?.firstName || 'Admin',
          time: new Date().toISOString(),
          is_admin_action: true
        },
        ...(prev[activeDivKey] || [])
      ]
    }));

    setNewMemberFirst('');
    setNewMemberLast('');
    setNewMemberUser('');
    setNewMemberEmail('');
  };

  // Mail Handlers
  const handleSendMail = (e: React.FormEvent) => {
    e.preventDefault();
    setMailErr('');
    if (!mailTo || !mailSubj || !mailBody) {
      setMailErr('To, subject, and message are all required.');
      return;
    }

    const newMail: MailItem = {
      id: 'ml_' + Date.now(),
      direction: 'outbound',
      from_addr: curUser?.email || 'admin@lvo-cloud.cloud',
      to_addr: mailTo.trim(),
      subject: mailSubj.trim(),
      created_at: new Date().toISOString()
    };

    setMailByDiv((prev) => ({
      ...prev,
      [activeDivKey]: [newMail, ...(prev[activeDivKey] || [])]
    }));

    setMailTo('');
    setMailSubj('');
    setMailBody('');
  };

  // Announcement Handlers
  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    setAnnErr('');
    if (!annTitle || !annBody) {
      setAnnErr('Title and body required.');
      return;
    }

    const newAnn: AnnouncementItem = {
      id: 'an_' + Date.now(),
      title: annTitle.trim(),
      body: annBody.trim(),
      pinned: false,
      division: curDiv.name
    };

    setAnnouncementsByDiv((prev) => ({
      ...prev,
      [activeDivKey]: [newAnn, ...(prev[activeDivKey] || [])]
    }));

    setAnnTitle('');
    setAnnBody('');
  };

  const handleTogglePinAnnouncement = (id: string) => {
    setAnnouncementsByDiv((prev) => ({
      ...prev,
      [activeDivKey]: (prev[activeDivKey] || []).map((a) => (a.id === id ? { ...a, pinned: !a.pinned } : a))
    }));
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    setAnnouncementsByDiv((prev) => ({
      ...prev,
      [activeDivKey]: (prev[activeDivKey] || []).filter((a) => a.id !== id)
    }));
  };

  // Chat Handlers
  const handleCreateChatUser = (e: React.FormEvent) => {
    e.preventDefault();
    setChatUserErr('');
    if (!chatNewUser || !chatNewPw) {
      setChatUserErr('Username and password are required.');
      return;
    }
    if (chatNewPw.length < 8) {
      setChatUserErr('Password must be at least 8 characters.');
      return;
    }

    const newUser: ChatUser = {
      id: chatNewUser.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
      displayName: chatNewName.trim() || chatNewUser,
      role: chatNewRole,
      mustChangePassword: true
    };

    setChatUsers((prev) => [...prev, newUser]);
    setChatNewUser('');
    setChatNewName('');
    setChatNewPw('');
  };

  const handleResetChatPassword = (id: string, name: string) => {
    const pw = prompt(`New password for ${name} (min 8 characters):`);
    if (!pw) return;
    if (pw.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    alert(`Password reset for ${name}. They will be prompted to change on next login.`);
  };

  const handleRemoveChatUser = (id: string, name: string) => {
    if (!confirm(`Remove ${name} from Chat?`)) return;
    setChatUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const handleCreateChannel = (e: React.FormEvent) => {
    e.preventDefault();
    setChannelErr('');
    if (!channelNewName.trim()) {
      setChannelErr('Channel name is required.');
      return;
    }

    const members: ChatChannelMember[] = [
      { id: 'lvo_admin', displayName: 'LVO Administrator', canPost: true },
      ...selectedMemberIds.map((id) => {
        const u = chatUsers.find((cu) => cu.id === id);
        return {
          id,
          displayName: u?.displayName || id,
          canPost: channelNewType === 'group'
        };
      })
    ];

    const newChannel: ChatChannel = {
      id: channelNewName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: channelNewName.trim(),
      type: channelNewType,
      memberCount: members.length,
      messageCount: 0,
      lastActivity: new Date().toISOString(),
      members
    };

    setChatChannels((prev) => [...prev, newChannel]);
    setChannelNewName('');
    setSelectedMemberIds([]);
  };

  const handleDeleteChannel = (id: string, name: string) => {
    if (!confirm(`Delete channel "${name}"? This removes it for everyone.`)) return;
    setChatChannels((prev) => prev.filter((c) => c.id !== id));
    if (expandedChannelId === id) setExpandedChannelId(null);
  };

  const handleToggleCanPost = (channelId: string, memberId: string, canPost: boolean) => {
    setChatChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        return {
          ...ch,
          members: ch.members.map((m) => (m.id === memberId ? { ...m, canPost } : m))
        };
      })
    );
  };

  const handleRemoveChannelMember = (channelId: string, memberId: string) => {
    setChatChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        const filtered = ch.members.filter((m) => m.id !== memberId);
        return {
          ...ch,
          members: filtered,
          memberCount: filtered.length
        };
      })
    );
  };

  const handleAddChannelMember = (channelId: string, memberId: string) => {
    const u = chatUsers.find((cu) => cu.id === memberId);
    if (!u) return;

    setChatChannels((prev) =>
      prev.map((ch) => {
        if (ch.id !== channelId) return ch;
        if (ch.members.some((m) => m.id === memberId)) return ch;
        const newMembers = [...ch.members, { id: u.id, displayName: u.displayName, canPost: ch.type === 'group' }];
        return {
          ...ch,
          members: newMembers,
          memberCount: newMembers.length
        };
      })
    );
  };

  return (
    <div
      className="flex min-h-screen font-['Inter',system-ui,sans-serif] transition-colors duration-150"
      style={{
        backgroundColor: theme.bg,
        color: theme.ink
      }}
    >
      {/* ── Left Sidebar ── */}
      <aside
        className="w-[280px] shrink-0 border-r flex flex-col p-9 pb-6 sticky top-0 h-screen overflow-y-auto"
        style={{
          backgroundColor: theme.bg,
          borderColor: theme.line
        }}
      >
        {/* Back to Menu (Classified Access Terminal) */}
        <button
          onClick={onBackToMenu}
          className="inline-flex items-center gap-2 self-start font-mono text-[10.5px] tracking-wider uppercase px-3 py-2 border rounded transition-colors mb-6 cursor-pointer"
          style={{
            color: theme.inkDim,
            borderColor: theme.line,
            backgroundColor: theme.bgRaised
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.ink;
            e.currentTarget.style.borderColor = accentDim;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = theme.inkDim;
            e.currentTarget.style.borderColor = theme.line;
          }}
        >
          <span className="text-xs leading-none">←</span>
          <span>Menu</span>
        </button>

        {/* Brand */}
        <div>
          <div
            className="w-[34px] h-[34px] border flex items-center justify-center font-['Fraunces',serif] text-base mb-3 shrink-0"
            style={{
              borderColor: accentDim,
              color: accentColor
            }}
          >
            L
          </div>
          <h1 className="font-['Fraunces',serif] font-medium text-[22px] tracking-tight m-0" style={{ color: theme.ink }}>
            LVO Holdings
          </h1>
          <div className="font-mono text-[11px] tracking-[0.14em] uppercase mt-1" style={{ color: theme.inkDim }}>
            Command Center
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] my-5" style={{ backgroundColor: theme.line }} />

        {/* Universal Cloud Navigation */}
        <div className="flex flex-col gap-1.5 mb-6">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase mb-1 flex items-center justify-between" style={{ color: theme.inkDim }}>
            <span>Universal Cloud</span>
            <span className="text-[9px] text-amber-400 font-mono">lvo-cloud.cloud</span>
          </div>
          {CLUSTER_VIEWS.map((cv) => {
            const isActive = activeDivKey === cv.key;
            return (
              <button
                key={cv.key}
                onClick={() => {
                  setActiveDivKey(cv.key);
                  setActiveTab('team');
                  setExpandedChannelId(null);
                }}
                className="py-2.5 px-3 border text-left text-xs cursor-pointer flex justify-between items-center transition-all rounded"
                style={{
                  backgroundColor: isActive ? theme.bgRaised : 'transparent',
                  borderColor: isActive ? cv.accent : theme.line,
                  color: isActive ? theme.ink : theme.inkDim
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{cv.icon}</span>
                  <span className="font-medium">{cv.name}</span>
                </div>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cv.accent }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-[1px] mb-5" style={{ backgroundColor: theme.line }} />

        {/* Divisions Switcher */}
        <div className="flex flex-col gap-1 mb-6">
          <div className="font-mono text-[10.5px] tracking-[0.14em] uppercase mb-1" style={{ color: theme.inkDim }}>
            Subsidiary Divisions
          </div>
          {DIVISIONS.map((d) => {
            const isLinked = !!linkedDivs[d.key];
            const isActive = activeDivKey === d.key;
            return (
              <button
                key={d.key}
                onClick={() => handleSwitchDiv(d.key)}
                className="p-2.5 border text-left text-xs cursor-pointer flex justify-between items-center transition-all rounded"
                style={{
                  backgroundColor: isActive ? theme.bgRaised : 'transparent',
                  borderColor: isActive ? accentDim : theme.line,
                  color: isActive ? theme.ink : theme.inkDim
                }}
              >
                <span className="font-medium">{d.name}</span>
                <span
                  className="font-mono text-[9px] uppercase font-semibold"
                  style={{
                    color: isLinked ? '#7a9a6f' : theme.inkFaint
                  }}
                >
                  {isLinked ? 'LINKED' : 'SIGN IN'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Nav Tabs for Linked Division (if not in cluster view) */}
        {!isClusterView && isCurLinked && (
          <div className="flex flex-col gap-1 mb-6">
            <div className="h-[1px] mb-4" style={{ backgroundColor: theme.line }} />
            {(curDiv.kind === 'chat'
              ? [
                  { id: 'team', label: 'Members' },
                  { id: 'channels', label: 'Channels' },
                  { id: 'dms', label: 'Direct Messages' }
                ]
              : [
                  { id: 'team', label: 'Team' },
                  { id: 'mailbox', label: 'Mailbox' },
                  { id: 'announcements', label: 'Announcements' },
                  { id: 'activity', label: 'Activity' }
                ]
            ).map((t) => {
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTab(t.id);
                    setExpandedChannelId(null);
                  }}
                  className="py-2 px-3 rounded text-[13.5px] flex items-center gap-2 cursor-pointer border transition-all text-left"
                  style={{
                    color: active ? theme.ink : theme.inkDim,
                    backgroundColor: active ? theme.bgRaised : 'transparent',
                    borderColor: active ? theme.line : 'transparent'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto pt-5 border-t" style={{ borderColor: theme.line }}>
          <div>
            <div className="text-[13px] font-medium" style={{ color: theme.ink }}>
              {authProfile?.displayName || (curUser ? `${curUser.firstName} ${curUser.lastName}` : 'Operator')}
            </div>
            <div className="text-xs truncate font-mono mt-0.5" style={{ color: theme.inkFaint }}>
              {authUser?.email || curUser?.email || 'admin@lvo-cloud.cloud'}
            </div>
            <div
              className="inline-block mt-2 font-mono text-[10px] uppercase tracking-wider px-2 py-0.5 border"
              style={{
                color: accentColor,
                borderColor: accentDim
              }}
            >
              {isAdmin ? '🛡 CLUSTER ADMINISTRATOR' : 'OPERATOR MEMBER'}
            </div>
            <div
              onClick={async () => {
                await logout();
                onBackToMenu();
              }}
              className="mt-3 text-[12px] cursor-pointer hover:underline transition-colors"
              style={{ color: '#b3564a' }}
            >
              Sign out of Universal Session
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main View ── */}
      <main className="flex-1 p-10 max-w-[1180px] min-w-0">
        {/* Division or Cluster Header */}
        <div className="flex justify-between items-start mb-6 gap-4">
          <div>
            <div className="font-mono text-[11px] tracking-[0.14em] uppercase" style={{ color: theme.inkDim }}>
              {isClusterView && curCluster ? 'LVO-CLOUD.CLOUD UNIVERSAL GATEWAY' : curDiv.name.toUpperCase()}
            </div>
            <h2 className="font-['Fraunces',serif] font-medium text-3xl mt-1" style={{ color: theme.ink }}>
              {isClusterView && curCluster ? curCluster.name : curDiv.name}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {isClusterView ? (
              <div className="flex items-center gap-2 border px-3 py-1.5 rounded" style={{ borderColor: theme.line, backgroundColor: theme.bgRaised }}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-xs uppercase" style={{ color: theme.inkDim }}>
                  Firestore Real-Time Sync
                </span>
              </div>
            ) : isCurLinked ? (
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: accentColor }}
                />
                <span className="font-mono text-xs uppercase" style={{ color: theme.inkDim }}>
                  Cluster Active
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Real-time status notification banner */}
        {statusFeedback && (
          <div className="mb-6 p-3 border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 font-mono text-xs flex items-center justify-between rounded animate-fade-in">
            <span>✓ {statusFeedback}</span>
            <button onClick={() => setStatusFeedback(null)} className="text-emerald-400 hover:text-white cursor-pointer ml-3">✕</button>
          </div>
        )}

        {/* Division or Cluster Content */}
        {isClusterView ? (
          <div>
            {/* 1. Universal IAM & Permissions View */}
            {activeDivKey === 'iam' && (
              <div>
                {/* STAT CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 border rounded" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                    <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: theme.inkDim }}>Universal Accounts</div>
                    <div className="font-mono text-2xl font-bold mt-1" style={{ color: theme.ink }}>{realUsers.length}</div>
                    <div className="text-xs mt-1" style={{ color: theme.inkFaint }}>Registered across all subdomains</div>
                  </div>
                  <div className="p-4 border rounded" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                    <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: theme.inkDim }}>Administrators</div>
                    <div className="font-mono text-2xl font-bold mt-1" style={{ color: '#C8A96E' }}>
                      {realUsers.filter((u) => u.role === 'admin').length}
                    </div>
                    <div className="text-xs mt-1" style={{ color: theme.inkFaint }}>With full cluster IAM rights</div>
                  </div>
                  <div className="p-4 border rounded" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                    <div className="font-mono text-[10px] uppercase tracking-wider" style={{ color: theme.inkDim }}>Connected Repositories</div>
                    <div className="font-mono text-2xl font-bold mt-1" style={{ color: '#4A90D9' }}>5 Applications</div>
                    <div className="text-xs mt-1" style={{ color: theme.inkFaint }}>Governed by central RBAC rules</div>
                  </div>
                </div>

                {/* ACTION BAR */}
                <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-wider font-semibold" style={{ color: theme.ink }}>
                      Universal Directory & Role-Based Access Control (RBAC)
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: theme.inkDim }}>
                      Toggle permissions below. Changes immediately sync to Firestore and propagate to all 5 GitHub applications.
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="font-mono text-xs uppercase px-3.5 py-2 border-none cursor-pointer font-medium rounded flex items-center gap-1.5 transition-opacity hover:opacity-90"
                      style={{ backgroundColor: theme.ink, color: theme.btnText }}
                    >
                      <span>+</span>
                      <span>Add Universal Account</span>
                    </button>
                  )}
                </div>

                {/* USERS PERMISSIONS TABLE */}
                <div className="border rounded overflow-x-auto mb-8 shadow-sm" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b font-mono uppercase text-[10px] tracking-wider" style={{ borderColor: theme.line, color: theme.inkDim }}>
                        <th className="p-3.5">Operator Identity</th>
                        <th className="p-3.5">Cluster Role</th>
                        <th className="p-3.5 text-center">📊 Dashboard</th>
                        <th className="p-3.5 text-center">💬 ChatLVO</th>
                        <th className="p-3.5 text-center">🟢 Status</th>
                        <th className="p-3.5 text-center">🎧 Support</th>
                        <th className="p-3.5 text-center">📑 Doc</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: theme.lineSoft }}>
                      {realUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center" style={{ color: theme.inkFaint }}>
                            No user accounts found in Firestore. Click "+ Add Universal Account" or sign in to auto-provision.
                          </td>
                        </tr>
                      ) : (
                        realUsers.map((u) => {
                          const perms = u.permissions || {
                            dashboard: false,
                            chat: false,
                            status: false,
                            support: false,
                            doc: false
                          };
                          return (
                            <tr key={u.uid} className="hover:bg-white/[0.02] transition-colors">
                              <td className="p-3.5">
                                <div className="font-medium text-[13px]" style={{ color: theme.ink }}>
                                  {u.displayName || u.email.split('@')[0]}
                                </div>
                                <div className="font-mono text-[11px]" style={{ color: theme.inkDim }}>
                                  {u.email}
                                </div>
                                <div className="font-mono text-[9px] mt-0.5" style={{ color: theme.inkFaint }}>
                                  UID: {u.uid}
                                </div>
                              </td>
                              <td className="p-3.5">
                                <select
                                  value={u.role || 'member'}
                                  disabled={!isAdmin}
                                  onChange={(e) => handleUpdateRole(u.uid, e.target.value as any)}
                                  className="font-mono text-xs p-1.5 border rounded outline-none cursor-pointer"
                                  style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                                >
                                  <option value="member">Member</option>
                                  <option value="developer">Developer</option>
                                  <option value="admin">Administrator</option>
                                </select>
                              </td>
                              {(['dashboard', 'chat', 'status', 'support', 'doc'] as ServiceKey[]).map((sk) => {
                                const isAllowed = !!perms[sk];
                                return (
                                  <td key={sk} className="p-3.5 text-center">
                                    <label className="inline-flex items-center justify-center cursor-pointer p-1">
                                      <input
                                        type="checkbox"
                                        disabled={!isAdmin}
                                        checked={isAllowed}
                                        onChange={() => handleTogglePermission(u.uid, sk)}
                                        className="w-4 h-4 rounded cursor-pointer accent-amber-500"
                                      />
                                    </label>
                                  </td>
                                );
                              })}
                              <td className="p-3.5 text-right">
                                {isAdmin && u.email !== 'lvo.lmarts@gmail.com' && (
                                  <button
                                    onClick={() => handleDeleteUser(u.uid, u.email)}
                                    className="font-mono text-[10px] uppercase text-red-500 hover:text-red-400 cursor-pointer p-1"
                                  >
                                    Delete
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. Connected Cloud Apps & SSO Gateway */}
            {activeDivKey === 'apps' && (
              <div>
                <div className="mb-6 p-4 border rounded" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-xs uppercase tracking-wider font-semibold" style={{ color: theme.ink }}>
                    Connected Repositories & Subdomains
                  </div>
                  <div className="text-xs mt-1 leading-relaxed" style={{ color: theme.inkDim }}>
                    These 5 GitHub applications share the universal authentication credentials and permissions matrix configured on this main node (<span className="text-amber-400 font-mono">lvo-cloud.cloud</span>). Operators can launch any service directly with their verified SSO token.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {UNIVERSAL_APPS.map((app) => {
                    const permitted = hasPermission(app.key);
                    return (
                      <div
                        key={app.key}
                        className="p-5 border rounded flex flex-col justify-between transition-all"
                        style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-2.5">
                              <span className="text-2xl">{app.icon}</span>
                              <div>
                                <h3 className="font-medium text-base leading-tight" style={{ color: theme.ink }}>
                                  {app.name}
                                </h3>
                                <div className="font-mono text-[11px] text-amber-400 mt-0.5">
                                  {app.subdomain}
                                </div>
                              </div>
                            </div>

                            <span
                              className="font-mono text-[9.5px] uppercase font-semibold px-2 py-0.5 border rounded"
                              style={{
                                borderColor: permitted ? '#1D9E75' : '#b3564a',
                                color: permitted ? '#1D9E75' : '#b3564a'
                              }}
                            >
                              {permitted ? '✓ AUTHORIZED' : '🔒 RESTRICTED'}
                            </span>
                          </div>

                          <p className="text-xs leading-relaxed mb-4" style={{ color: theme.inkDim }}>
                            {app.description}
                          </p>

                          <div className="font-mono text-[10.5px] mb-4 flex items-center gap-1.5" style={{ color: theme.inkFaint }}>
                            <span>Repository:</span>
                            <a
                              href={app.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:underline truncate"
                            >
                              {app.githubRepo}
                            </a>
                          </div>
                        </div>

                        <div className="pt-3 border-t flex items-center justify-between gap-3" style={{ borderColor: theme.line }}>
                          {permitted ? (
                            <a
                              href={`https://${app.subdomain}?token=sso_universal_token&user=${encodeURIComponent(authUser?.email || 'admin')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="w-full text-center font-mono text-xs uppercase py-2.5 px-4 rounded font-medium transition-all"
                              style={{ backgroundColor: theme.ink, color: theme.btnText }}
                            >
                              🚀 Launch with SSO Token
                            </a>
                          ) : (
                            <button
                              onClick={() => {
                                logSSOEvent(app.name, 'verify_token', `User requested access to ${app.name}`);
                                setStatusFeedback(`Access request for ${app.name} submitted to cluster administrators.`);
                                setTimeout(() => setStatusFeedback(null), 4000);
                              }}
                              className="w-full text-center font-mono text-xs uppercase py-2.5 px-4 border rounded font-medium cursor-pointer transition-all"
                              style={{ borderColor: theme.line, color: theme.inkDim, backgroundColor: theme.bg }}
                            >
                              Request Access Clearance
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* ARCHITECTURE RUNBOOK */}
                <div className="p-5 border rounded" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-xs uppercase tracking-wider font-semibold mb-2" style={{ color: theme.ink }}>
                    SSO Integration Architecture (Single Universal System)
                  </div>
                  <div className="text-xs leading-relaxed space-y-2" style={{ color: theme.inkDim }}>
                    <p>
                      <strong>How each GitHub repo accepts this login:</strong> Each application under <span className="font-mono text-amber-400">*.lvo-cloud.cloud</span> queries the central Firebase Firestore <span className="font-mono text-amber-400">users/{'{uid}'}</span> document to read <span className="font-mono text-amber-400">permissions.{'{service}'}</span>.
                    </p>
                    <div className="p-3 bg-black/40 rounded font-mono text-[11px] text-gray-300 border border-white/5 overflow-x-auto">
                      <code>
                        {`// Universal SSO Verification in Sub-Apps:
import { doc, getDoc } from 'firebase/firestore';
const userDoc = await getDoc(doc(db, 'users', session.uid));
if (!userDoc.data()?.permissions?.[SERVICE_KEY]) {
  window.location.href = 'https://lvo-cloud.cloud/login?error=unauthorized';
}`}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SSO Cluster Logs View */}
            {activeDivKey === 'logs' && (
              <div>
                <div className="border rounded overflow-x-auto mb-8 shadow-sm" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b font-mono uppercase text-[10px] tracking-wider" style={{ borderColor: theme.line, color: theme.inkDim }}>
                        <th className="p-3.5">Timestamp</th>
                        <th className="p-3.5">User</th>
                        <th className="p-3.5">Action</th>
                        <th className="p-3.5">Status</th>
                        <th className="p-3.5">Service / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: theme.lineSoft }}>
                      {realSSOLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center" style={{ color: theme.inkFaint }}>
                            No SSO log events recorded yet. Authentication and permission changes will stream here in real time.
                          </td>
                        </tr>
                      ) : (
                        realSSOLogs.map((l) => (
                          <tr key={l.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-3.5 font-mono text-[11px]" style={{ color: theme.inkDim }}>
                              {new Date(l.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5 font-medium" style={{ color: theme.ink }}>
                              {l.userEmail}
                            </td>
                            <td className="p-3.5 font-mono uppercase text-[10.5px]">
                              {l.action}
                            </td>
                            <td className="p-3.5">
                              <span
                                className="font-mono text-[9px] uppercase px-1.5 py-0.5 border rounded"
                                style={{
                                  borderColor: l.status === 'success' ? '#1D9E75' : '#b3564a',
                                  color: l.status === 'success' ? '#1D9E75' : '#b3564a'
                                }}
                              >
                                {l.status}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-[11px]" style={{ color: theme.inkFaint }}>
                              {l.service || l.ip || 'lvo-cloud.cloud core node'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : !isCurLinked ? (
          /* Sign-In View */
          <div className="max-w-[420px] mx-auto my-16">
            <div className="p-6 border" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
              <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                Sign in — {curDiv.name}
              </div>

              {pendingCode ? (
                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                      Verification code sent to {loginId}
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={codeVal}
                      onChange={(e) => setCodeVal(e.target.value.replace(/\D/g, ''))}
                      placeholder="000000"
                      className="w-full text-center text-xl font-mono tracking-[0.4em] p-2.5 border outline-none"
                      style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                    />
                  </div>
                  {loginErr && <div className="text-xs text-red-500">{loginErr}</div>}
                  <button
                    type="submit"
                    className="w-full font-mono text-xs uppercase tracking-wider py-3 border-none cursor-pointer font-medium"
                    style={{ backgroundColor: theme.ink, color: theme.btnText }}
                  >
                    Verify & sign in
                  </button>
                  <div className="text-xs leading-relaxed" style={{ color: theme.inkFaint }}>
                    Enter any 6-digit code or test code to complete sign-in.
                  </div>
                </form>
              ) : (
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                      Identifier
                    </label>
                    <input
                      type="text"
                      required
                      value={loginId}
                      onChange={(e) => setLoginId(e.target.value)}
                      placeholder={curDiv.kind === 'chat' ? 'Username' : 'Email or username'}
                      className="w-full p-2.5 border outline-none text-sm"
                      style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                    />
                  </div>

                  <div>
                    <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                      Password
                    </label>
                    <input
                      type="password"
                      required
                      value={loginPw}
                      onChange={(e) => setLoginPw(e.target.value)}
                      placeholder="Password"
                      className="w-full p-2.5 border outline-none text-sm"
                      style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                    />
                  </div>

                  {loginErr && <div className="text-xs text-red-500">{loginErr}</div>}

                  <button
                    type="submit"
                    className="w-full font-mono text-xs uppercase tracking-wider py-3 border-none cursor-pointer font-medium"
                    style={{ backgroundColor: theme.ink, color: theme.btnText }}
                  >
                    Continue
                  </button>

                  <div className="text-xs leading-relaxed" style={{ color: theme.inkFaint }}>
                    {curDiv.kind === 'chat'
                      ? 'Uses your existing Chat admin account. Sign-in is immediate.'
                      : `Uses your ${curDiv.name} administrator account. Verification code is requested for sign-in.`}
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : curDiv.kind === 'chat' ? (
          /* Chat Division Views */
          <div>
            {/* 1. Chat Members Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Chat Accounts ({chatUsers.length})
                  </div>

                  {chatUsers.length === 0 ? (
                    <div className="text-sm" style={{ color: theme.inkFaint }}>No chat accounts yet.</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                      {chatUsers.map((u) => (
                        <div key={u.id} className="py-4 flex justify-between items-center flex-wrap gap-4">
                          <div>
                            <div className="font-medium text-[15px]">{u.displayName || u.id}</div>
                            <div className="text-[13px] mt-0.5" style={{ color: theme.inkDim }}>
                              @{u.id} {u.mustChangePassword ? '· must change password' : ''}
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className="font-mono text-[10.5px] uppercase tracking-wider px-2.5 py-1 border"
                              style={{
                                color: u.role === 'admin' ? accentColor : theme.inkDim,
                                borderColor: u.role === 'admin' ? accentDim : theme.line
                              }}
                            >
                              {u.role === 'admin' ? 'Admin' : 'Member'}
                            </span>

                            <button
                              onClick={() => handleResetChatPassword(u.id, u.displayName)}
                              className="font-mono text-xs uppercase px-3 py-1.5 border-none cursor-pointer"
                              style={{ backgroundColor: theme.ink, color: theme.btnText }}
                            >
                              Reset password
                            </button>

                            {u.id !== 'lvo_admin' && (
                              <button
                                onClick={() => handleRemoveChatUser(u.id, u.displayName)}
                                className="font-mono text-[10.5px] uppercase tracking-wider border-none bg-transparent cursor-pointer p-0"
                                style={{ color: '#b3564a' }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Chat Account */}
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Create chat account
                  </div>
                  <form onSubmit={handleCreateChatUser} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="username (lowercase, 3-32 chars)"
                        value={chatNewUser}
                        onChange={(e) => setChatNewUser(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                      <input
                        type="text"
                        placeholder="Display name (optional)"
                        value={chatNewName}
                        onChange={(e) => setChatNewName(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <input
                        type="password"
                        required
                        placeholder="Temporary password (8+ chars)"
                        value={chatNewPw}
                        onChange={(e) => setChatNewPw(e.target.value)}
                        className="flex-1 min-w-[200px] p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />

                      <select
                        value={chatNewRole}
                        onChange={(e) => setChatNewRole(e.target.value as any)}
                        className="font-mono text-xs p-2.5 border outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>

                      <button
                        type="submit"
                        className="font-mono text-xs uppercase px-5 py-2.5 border-none cursor-pointer font-medium"
                        style={{ backgroundColor: theme.ink, color: theme.btnText }}
                      >
                        Create account
                      </button>
                    </div>

                    {chatUserErr && <div className="text-xs text-red-500">{chatUserErr}</div>}
                    <div className="text-xs leading-relaxed" style={{ color: theme.inkFaint }}>
                      They will be asked to change this password the first time they sign in.
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. Chat Channels Tab */}
            {activeTab === 'channels' && (
              <div className="space-y-6">
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Active Channels ({chatChannels.length})
                  </div>

                  <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                    {chatChannels.map((ch) => {
                      const isExpanded = expandedChannelId === ch.id;
                      return (
                        <div key={ch.id} className="py-4">
                          <div className="flex justify-between items-center flex-wrap gap-4">
                            <div>
                              <div className="font-medium text-[15px] flex items-center gap-2">
                                <span>{ch.type === 'announcement' ? '📢' : '#'} {ch.name}</span>
                                <span
                                  className="font-mono text-[10px] uppercase px-1.5 py-0.5 border"
                                  style={{ borderColor: accentDim, color: accentColor }}
                                >
                                  {ch.type}
                                </span>
                              </div>
                              <div className="text-[13px] mt-1" style={{ color: theme.inkDim }}>
                                {ch.memberCount} member{ch.memberCount === 1 ? '' : 's'} · {ch.messageCount} messages · last: {new Date(ch.lastActivity).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setExpandedChannelId(isExpanded ? null : ch.id)}
                                className="font-mono text-xs uppercase px-3.5 py-1.5 border-none cursor-pointer"
                                style={{ backgroundColor: theme.ink, color: theme.btnText }}
                              >
                                {isExpanded ? 'Hide' : 'Manage'}
                              </button>

                              {ch.id !== 'general' && (
                                <button
                                  onClick={() => handleDeleteChannel(ch.id, ch.name)}
                                  className="font-mono text-[10.5px] uppercase tracking-wider border-none bg-transparent cursor-pointer p-0"
                                  style={{ color: '#b3564a' }}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Channel Management Sub-Panel */}
                          {isExpanded && (
                            <div
                              className="mt-4 p-4 border rounded"
                              style={{ backgroundColor: theme.bg, borderColor: theme.line }}
                            >
                              <div className="font-mono text-[10.5px] uppercase tracking-wider mb-3" style={{ color: theme.inkDim }}>
                                Channel Members ({ch.members.length})
                              </div>

                              <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                                {ch.members.map((m) => (
                                  <div key={m.id} className="py-2.5 flex justify-between items-center">
                                    <div>
                                      <div className="text-sm font-medium">{m.displayName}</div>
                                      <div className="text-xs font-mono" style={{ color: theme.inkDim }}>@{m.id}</div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                      {ch.type === 'announcement' && (
                                        <label className="flex items-center gap-1.5 text-xs font-mono" style={{ color: theme.inkDim }}>
                                          <input
                                            type="checkbox"
                                            checked={!!m.canPost}
                                            onChange={(e) => handleToggleCanPost(ch.id, m.id, e.target.checked)}
                                          />
                                          can post
                                        </label>
                                      )}

                                      {m.id !== 'lvo_admin' && (
                                        <button
                                          onClick={() => handleRemoveChannelMember(ch.id, m.id)}
                                          className="font-mono text-[10px] uppercase px-2 py-1 border-none cursor-pointer"
                                          style={{ backgroundColor: theme.bgRaised, color: '#b3564a' }}
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* Add Candidate Member */}
                              {chatUsers.some((u) => !ch.members.some((m) => m.id === u.id)) && (
                                <div className="mt-4 pt-3 border-t flex gap-2" style={{ borderColor: theme.line }}>
                                  <select
                                    id={`add-member-${ch.id}`}
                                    className="p-2 border text-xs outline-none flex-1"
                                    style={{ backgroundColor: theme.bgRaised, borderColor: theme.line, color: theme.ink }}
                                  >
                                    {chatUsers
                                      .filter((u) => !ch.members.some((m) => m.id === u.id))
                                      .map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.displayName} (@{u.id})
                                        </option>
                                      ))}
                                  </select>
                                  <button
                                    onClick={() => {
                                      const sel = document.getElementById(`add-member-${ch.id}`) as HTMLSelectElement;
                                      if (sel && sel.value) handleAddChannelMember(ch.id, sel.value);
                                    }}
                                    className="font-mono text-xs uppercase px-3 py-2 border-none cursor-pointer"
                                    style={{ backgroundColor: theme.ink, color: theme.btnText }}
                                  >
                                    Add member
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Create Channel Form */}
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Create channel
                  </div>
                  <form onSubmit={handleCreateChannel} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Channel name"
                        value={channelNewName}
                        onChange={(e) => setChannelNewName(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />

                      <select
                        value={channelNewType}
                        onChange={(e) => setChannelNewType(e.target.value as any)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      >
                        <option value="group">Group</option>
                        <option value="announcement">Announcement</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider mb-2" style={{ color: theme.inkFaint }}>
                        Initial Members
                      </label>
                      <div
                        className="max-h-[160px] overflow-y-auto p-3 border space-y-2"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line }}
                      >
                        {chatUsers.map((u) => (
                          <label key={u.id} className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedMemberIds.includes(u.id)}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedMemberIds((prev) => [...prev, u.id]);
                                else setSelectedMemberIds((prev) => prev.filter((id) => id !== u.id));
                              }}
                            />
                            <span>{u.displayName} (@{u.id})</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {channelErr && <div className="text-xs text-red-500">{channelErr}</div>}

                    <button
                      type="submit"
                      className="font-mono text-xs uppercase px-5 py-2.5 border-none cursor-pointer font-medium"
                      style={{ backgroundColor: theme.ink, color: theme.btnText }}
                    >
                      Create channel
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 3. Direct Messages Tab */}
            {activeTab === 'dms' && (
              <div className="space-y-4">
                <div className="text-xs leading-relaxed" style={{ color: theme.inkFaint }}>
                  Direct messages stay end-to-end encrypted — this shows only who has talked to whom and when, never message content.
                </div>

                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  {dmThreads.length === 0 ? (
                    <div className="text-sm" style={{ color: theme.inkFaint }}>No direct-message activity yet.</div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                      {dmThreads.map((t) => (
                        <div key={t.id} className="py-3.5 flex justify-between items-center">
                          <div>
                            <div className="font-medium text-sm">
                              {t.userA.displayName} ↔ {t.userB.displayName}
                            </div>
                            <div className="text-xs font-mono mt-0.5" style={{ color: theme.inkDim }}>
                              last activity: {new Date(t.lastActivity).toLocaleString()}
                            </div>
                          </div>
                          <span
                            className="font-mono text-[10px] uppercase px-2 py-0.5 border"
                            style={{ borderColor: accentDim, color: accentColor }}
                          >
                            E2E Encrypted
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Standard Divisions (Alliance, Vindex, Operations, Careers) */
          <div>
            {/* 1. Team Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Active Personnel ({membersByDiv[activeDivKey]?.length || 0})
                  </div>

                  <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                    {(membersByDiv[activeDivKey] || []).map((m) => (
                      <div key={m.uid} className="py-4 flex justify-between items-center flex-wrap gap-4">
                        <div>
                          <div className="font-medium text-[15px]">{m.name}</div>
                          <div className="text-[13px] mt-0.5" style={{ color: theme.inkDim }}>{m.email}</div>
                        </div>

                        <div className="flex items-center gap-3">
                          <select
                            defaultValue={m.tier}
                            id={`tier-${m.uid}`}
                            className="font-mono text-xs p-2 border outline-none"
                            style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                          >
                            {Object.entries(TIER_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>{label}</option>
                            ))}
                          </select>

                          <select
                            defaultValue={m.role}
                            id={`role-${m.uid}`}
                            className="font-mono text-xs p-2 border outline-none"
                            style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>

                          <button
                            onClick={() => {
                              const tVal = parseInt((document.getElementById(`tier-${m.uid}`) as HTMLSelectElement).value);
                              const rVal = (document.getElementById(`role-${m.uid}`) as HTMLSelectElement).value as any;
                              handleSaveMember(m.uid, tVal, rVal);
                            }}
                            className="font-mono text-xs uppercase px-3.5 py-2 border-none cursor-pointer"
                            style={{ backgroundColor: theme.ink, color: theme.btnText }}
                          >
                            Save
                          </button>

                          <button
                            onClick={() => handleRemoveMember(m.uid)}
                            className="font-mono text-[10.5px] uppercase tracking-wider border-none bg-transparent cursor-pointer p-0"
                            style={{ color: '#b3564a' }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Create Member Form */}
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Create member
                  </div>

                  <form onSubmit={handleCreateMember} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="First name"
                        value={newMemberFirst}
                        onChange={(e) => setNewMemberFirst(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Last name"
                        value={newMemberLast}
                        onChange={(e) => setNewMemberLast(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        required
                        placeholder="Username"
                        value={newMemberUser}
                        onChange={(e) => setNewMemberUser(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                      <input
                        type="email"
                        required
                        placeholder="name@company.com"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        className="p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-3 items-center">
                      <select
                        value={newMemberTier}
                        onChange={(e) => setNewMemberTier(parseInt(e.target.value))}
                        className="font-mono text-xs p-2.5 border outline-none flex-1"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      >
                        {Object.entries(TIER_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>

                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value as any)}
                        className="font-mono text-xs p-2.5 border outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>

                      <button
                        type="submit"
                        className="font-mono text-xs uppercase px-5 py-2.5 border-none cursor-pointer font-medium"
                        style={{ backgroundColor: theme.ink, color: theme.btnText }}
                      >
                        Create & email credentials
                      </button>
                    </div>

                    {memberFormErr && <div className="text-xs text-red-500">{memberFormErr}</div>}
                    <div className="text-xs leading-relaxed" style={{ color: theme.inkFaint }}>
                      A temporary password is generated and emailed automatically. The new account is pre-verified.
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. Mailbox Tab */}
            {activeTab === 'mailbox' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Compose Form */}
                <div className="lg:col-span-7 border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Compose
                  </div>
                  <form onSubmit={handleSendMail} className="space-y-4">
                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                        To
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="name@company.com"
                        value={mailTo}
                        onChange={(e) => setMailTo(e.target.value)}
                        className="w-full p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                        Subject
                      </label>
                      <input
                        type="text"
                        required
                        value={mailSubj}
                        onChange={(e) => setMailSubj(e.target.value)}
                        className="w-full p-2.5 border text-sm outline-none"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] uppercase tracking-wider mb-1.5" style={{ color: theme.inkFaint }}>
                        Message
                      </label>
                      <textarea
                        rows={4}
                        required
                        value={mailBody}
                        onChange={(e) => setMailBody(e.target.value)}
                        className="w-full p-2.5 border text-sm outline-none resize-y"
                        style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                      />
                    </div>

                    {mailErr && <div className="text-xs text-red-500">{mailErr}</div>}

                    <button
                      type="submit"
                      className="font-mono text-xs uppercase px-5 py-2.5 border-none cursor-pointer font-medium"
                      style={{ backgroundColor: theme.ink, color: theme.btnText }}
                    >
                      Send mail
                    </button>
                  </form>
                </div>

                {/* Mail Activity */}
                <div className="lg:col-span-5 border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Mailbox activity
                  </div>

                  <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                    {(mailByDiv[activeDivKey] || []).map((mm) => (
                      <div key={mm.id} className="py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[10px] uppercase px-1.5 py-0.5 border"
                            style={{
                              borderColor: mm.direction === 'inbound' ? '#7a9a6f' : accentDim,
                              color: mm.direction === 'inbound' ? '#7a9a6f' : accentColor
                            }}
                          >
                            {mm.direction === 'inbound' ? 'Received' : 'Sent'}
                          </span>
                          <span className="text-xs truncate font-mono" style={{ color: theme.inkDim }}>
                            {mm.direction === 'inbound' ? `From ${mm.from_addr}` : `To ${mm.to_addr}`}
                          </span>
                        </div>
                        <div className="text-sm font-medium mt-1">{mm.subject}</div>
                        <div className="text-[11px] font-mono mt-1" style={{ color: theme.inkFaint }}>
                          {new Date(mm.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. Announcements Tab */}
            {activeTab === 'announcements' && (
              <div className="space-y-6">
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Announcements ({announcementsByDiv[activeDivKey]?.length || 0})
                  </div>

                  <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                    {(announcementsByDiv[activeDivKey] || []).map((a) => (
                      <div key={a.id} className="py-4 flex justify-between items-start flex-wrap gap-4">
                        <div className="max-w-xl">
                          <div className="font-medium text-[15px] flex items-center gap-2">
                            {a.pinned && <span style={{ color: accentColor }}>◈</span>}
                            <span>{a.title}</span>
                          </div>
                          <div className="text-[13px] mt-1 leading-relaxed" style={{ color: theme.inkDim }}>
                            {a.body}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleTogglePinAnnouncement(a.id)}
                            className="font-mono text-xs uppercase px-3 py-1.5 border-none cursor-pointer"
                            style={{ backgroundColor: theme.ink, color: theme.btnText }}
                          >
                            {a.pinned ? 'Unpin' : 'Pin'}
                          </button>

                          <button
                            onClick={() => handleDeleteAnnouncement(a.id)}
                            className="font-mono text-[10.5px] uppercase tracking-wider border-none bg-transparent cursor-pointer p-0"
                            style={{ color: '#b3564a' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Post Announcement Form */}
                <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                  <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                    Post announcement — {curDiv.name}
                  </div>

                  <form onSubmit={handlePostAnnouncement} className="space-y-3">
                    <input
                      type="text"
                      required
                      placeholder="Title"
                      value={annTitle}
                      onChange={(e) => setAnnTitle(e.target.value)}
                      className="w-full p-2.5 border text-sm outline-none"
                      style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                    />

                    <textarea
                      rows={3}
                      required
                      placeholder="Body"
                      value={annBody}
                      onChange={(e) => setAnnBody(e.target.value)}
                      className="w-full p-2.5 border text-sm outline-none resize-y"
                      style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                    />

                    {annErr && <div className="text-xs text-red-500">{annErr}</div>}

                    <button
                      type="submit"
                      className="font-mono text-xs uppercase px-5 py-2.5 border-none cursor-pointer font-medium"
                      style={{ backgroundColor: theme.ink, color: theme.btnText }}
                    >
                      Post
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* 4. Activity Tab */}
            {activeTab === 'activity' && (
              <div className="border p-6" style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}>
                <div className="font-mono text-[11px] uppercase tracking-wider mb-4" style={{ color: theme.inkDim }}>
                  Audit Trail & Activity Log
                </div>

                <div className="divide-y" style={{ borderColor: theme.lineSoft }}>
                  {(activityByDiv[activeDivKey] || []).map((act) => (
                    <div key={act.id} className="py-3.5 flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{act.action}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: theme.inkDim }}>
                          {act.actor} · {new Date(act.time).toLocaleString()}
                        </div>
                      </div>

                      {act.is_admin_action && (
                        <span
                          className="font-mono text-[10px] uppercase px-2 py-0.5 border"
                          style={{ borderColor: accentDim, color: accentColor }}
                        >
                          Admin
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      {/* Add Universal User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div
            className="w-full max-w-md p-6 border rounded shadow-2xl relative"
            style={{ backgroundColor: theme.bgRaised, borderColor: theme.line }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-['Fraunces',serif] text-lg font-medium" style={{ color: theme.ink }}>
                Add Universal User Account
              </h3>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-gray-400 hover:text-white cursor-pointer font-mono text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUserSubmit} className="space-y-4">
              <div>
                <label className="block font-mono text-[10.5px] uppercase tracking-wider mb-1" style={{ color: theme.inkFaint }}>
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Elena Rostova"
                  value={newUniversalName}
                  onChange={(e) => setNewUniversalName(e.target.value)}
                  className="w-full p-2.5 border text-xs outline-none rounded"
                  style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                />
              </div>

              <div>
                <label className="block font-mono text-[10.5px] uppercase tracking-wider mb-1" style={{ color: theme.inkFaint }}>
                  Account Email (Universal Username)
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@lvo-cloud.cloud"
                  value={newUniversalEmail}
                  onChange={(e) => setNewUniversalEmail(e.target.value)}
                  className="w-full p-2.5 border text-xs outline-none rounded"
                  style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                />
              </div>

              <div>
                <label className="block font-mono text-[10.5px] uppercase tracking-wider mb-1" style={{ color: theme.inkFaint }}>
                  System Role
                </label>
                <select
                  value={newUniversalRole}
                  onChange={(e) => setNewUniversalRole(e.target.value as any)}
                  className="w-full p-2.5 border text-xs outline-none rounded cursor-pointer"
                  style={{ backgroundColor: theme.bg, borderColor: theme.line, color: theme.ink }}
                >
                  <option value="member">Member (Standard Tier)</option>
                  <option value="developer">Developer (Repository Access)</option>
                  <option value="admin">Administrator (Full IAM Control)</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[10.5px] uppercase tracking-wider mb-2" style={{ color: theme.inkFaint }}>
                  Initial Application Permissions
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {(['dashboard', 'chat', 'status', 'support', 'doc'] as ServiceKey[]).map((sk) => (
                    <label
                      key={sk}
                      className="flex items-center gap-2 p-2 border rounded cursor-pointer transition-colors"
                      style={{ borderColor: theme.line, backgroundColor: theme.bg }}
                    >
                      <input
                        type="checkbox"
                        checked={newUniversalPerms[sk]}
                        onChange={(e) =>
                          setNewUniversalPerms((p) => ({ ...p, [sk]: e.target.checked }))
                        }
                        className="rounded cursor-pointer accent-amber-500"
                      />
                      <span className="capitalize font-mono text-[11px]" style={{ color: theme.ink }}>
                        {sk === 'doc' ? 'Docs' : sk}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="font-mono text-xs uppercase px-4 py-2 border rounded cursor-pointer"
                  style={{ borderColor: theme.line, color: theme.inkDim }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="font-mono text-xs uppercase px-4 py-2 border-none rounded cursor-pointer font-medium"
                  style={{ backgroundColor: theme.ink, color: theme.btnText }}
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
