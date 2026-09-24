import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  db, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query,
  limit
} from '../firebase';
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Users, 
  Key, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  RefreshCw, 
  MessageSquare, 
  LayoutDashboard, 
  Activity, 
  LifeBuoy, 
  BookOpen, 
  Search, 
  UserCheck, 
  UserX,
  Sparkles,
  Inbox
} from 'lucide-react';
import type { UserProfile, ServicePermissions, ServiceKey, AccessRequest } from '../types';

const SERVICE_META: Record<ServiceKey, { label: string; icon: any; color: string; subdomain: string; repo: string }> = {
  dashboard: {
    label: 'Dashboard',
    icon: LayoutDashboard,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    subdomain: 'dashboard.lvo-cloud.cloud',
    repo: 'lvoholdings00-sys/LVO-Dashboard'
  },
  chat: {
    label: 'Chat LVO',
    icon: MessageSquare,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    subdomain: 'chat.lvo-cloud.cloud',
    repo: 'lvoholdings00-sys/chatlvo'
  },
  status: {
    label: 'Status',
    icon: Activity,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    subdomain: 'status.lvo-cloud.cloud',
    repo: 'lvoholdings00-sys/Status'
  },
  support: {
    label: 'Support',
    icon: LifeBuoy,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    subdomain: 'support.lvo-cloud.cloud',
    repo: 'lvoholdings00-sys/support'
  },
  doc: {
    label: 'Docs',
    icon: BookOpen,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    subdomain: 'docs.lvo-cloud.cloud',
    repo: 'lvoholdings00-sys/doc'
  }
};

export const PermissionsManager: React.FC = () => {
  const { user, profile, isAdmin, updateUserPermissions } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'member' | 'developer'>('all');
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Real-time listener for users
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const list: UserProfile[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as UserProfile;
        list.push({ ...data, uid: docSnap.id });
      });
      // Sort admins first, then by lastLoginAt
      list.sort((a, b) => {
        if (a.role === 'admin' && b.role !== 'admin') return -1;
        if (b.role === 'admin' && a.role !== 'admin') return 1;
        return (b.lastLoginAt || '').localeCompare(a.lastLoginAt || '');
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.warn('Users fetch error:', err);
      setLoading(false);
    });

    const unsubRequests = onSnapshot(collection(db, 'access_requests'), (snap) => {
      const reqList: AccessRequest[] = [];
      snap.forEach((docSnap) => {
        reqList.push({ id: docSnap.id, ...docSnap.data() } as AccessRequest);
      });
      reqList.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      setRequests(reqList);
    }, (err) => {
      console.warn('Access requests fetch error:', err);
    });

    return () => {
      unsubUsers();
      unsubRequests();
    };
  }, []);

  const handleTogglePermission = async (targetUser: UserProfile, serviceKey: ServiceKey) => {
    if (!isAdmin) {
      alert('Only administrators (lvo.lmarts@gmail.com) can modify user permissions.');
      return;
    }

    setSavingUid(targetUser.uid);
    try {
      const current = targetUser.permissions || {
        dashboard: false,
        chat: false,
        status: false,
        support: false,
        doc: false
      };

      const updatedPermissions: ServicePermissions = {
        ...current,
        [serviceKey]: !current[serviceKey]
      };

      await updateUserPermissions(targetUser.uid, updatedPermissions);
      setStatusMessage(`Updated ${SERVICE_META[serviceKey].label} permission for ${targetUser.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update permission: ' + err.message);
    } finally {
      setSavingUid(null);
    }
  };

  const handleGrantAll = async (targetUser: UserProfile) => {
    if (!isAdmin) return;
    setSavingUid(targetUser.uid);
    try {
      const allTrue: ServicePermissions = {
        dashboard: true,
        chat: true,
        status: true,
        support: true,
        doc: true
      };
      await updateUserPermissions(targetUser.uid, allTrue);
      setStatusMessage(`Granted all service access to ${targetUser.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUid(null);
    }
  };

  const handleRevokeAll = async (targetUser: UserProfile) => {
    if (!isAdmin) return;
    if (targetUser.email === 'lvo.lmarts@gmail.com') {
      alert('Root admin permissions cannot be revoked.');
      return;
    }
    setSavingUid(targetUser.uid);
    try {
      const allFalse: ServicePermissions = {
        dashboard: false,
        chat: false,
        status: false,
        support: false,
        doc: false
      };
      await updateUserPermissions(targetUser.uid, allFalse);
      setStatusMessage(`Revoked service access for ${targetUser.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUid(null);
    }
  };

  const handleChangeRole = async (targetUser: UserProfile, newRole: UserProfile['role']) => {
    if (!isAdmin) return;
    setSavingUid(targetUser.uid);
    try {
      const current = targetUser.permissions || {
        dashboard: false,
        chat: false,
        status: false,
        support: false,
        doc: false
      };
      await updateUserPermissions(targetUser.uid, current, newRole);
      setStatusMessage(`Updated role to ${newRole} for ${targetUser.email}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSavingUid(null);
    }
  };

  const handleApproveRequest = async (req: AccessRequest) => {
    if (!isAdmin) return;
    try {
      const targetUser = users.find(u => u.uid === req.userId);
      if (targetUser) {
        const perms: ServicePermissions = {
          ...(targetUser.permissions || {
            dashboard: false,
            chat: false,
            status: false,
            support: false,
            doc: false
          }),
          [req.serviceKey]: true
        };
        await updateUserPermissions(targetUser.uid, perms);
      }
      await updateDoc(doc(db, 'access_requests', req.id), { status: 'approved' });
      setStatusMessage(`Approved access to ${SERVICE_META[req.serviceKey]?.label || req.serviceKey} for ${req.userEmail}`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      alert('Failed to approve request: ' + err.message);
    }
  };

  const handleRejectRequest = async (req: AccessRequest) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'access_requests', req.id), { status: 'rejected' });
    } catch (err: any) {
      console.error(err);
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');

  const filteredUsers = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchEmail = u.email?.toLowerCase().includes(term);
      const matchName = u.displayName?.toLowerCase().includes(term);
      if (!matchEmail && !matchName) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header and IAM stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              Universal IAM & Access Control Matrix
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
              Cross-Domain RBAC
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Centrally manage user access rights across all 5 GitHub project subdomains: Dashboard, Chat, Status, Support, and Docs.
          </p>
        </div>

        {statusMessage && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-3.5 h-3.5" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* Pending Access Requests Banner (if any) */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-semibold text-amber-200">
              Pending Service Access Requests ({pendingRequests.length})
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingRequests.map(req => (
              <div key={req.id} className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-200 truncate max-w-[150px]">{req.userName || req.userEmail}</span>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                    {req.serviceKey}
                  </span>
                </div>
                <div className="text-[11px] text-neutral-400 truncate">{req.userEmail}</div>
                <div className="flex items-center gap-2 pt-1 border-t border-neutral-800">
                  <button
                    onClick={() => handleApproveRequest(req)}
                    className="flex-1 py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => handleRejectRequest(req)}
                    className="py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-[11px] cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Services Overview Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(SERVICE_META) as ServiceKey[]).map((key) => {
          const meta = SERVICE_META[key];
          const Icon = meta.icon;
          const userCountWithAccess = users.filter(u => u.role === 'admin' || u.permissions?.[key]).length;

          return (
            <div key={key} className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-1.5 rounded-lg border ${meta.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-mono text-neutral-500">
                  {userCountWithAccess} users
                </span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-neutral-200">{meta.label}</h5>
                <p className="text-[10px] font-mono text-neutral-500 truncate mt-0.5">{meta.subdomain}</p>
                <p className="text-[10px] text-neutral-600 truncate mt-0.5">{meta.repo}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-neutral-900/60 p-3 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search user name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as any)}
            className="px-2.5 py-1.5 text-xs bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="admin">Admins</option>
            <option value="developer">Developers</option>
            <option value="member">Members</option>
          </select>
        </div>

        <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400" /> Authorized
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-neutral-700" /> Restricted
          </span>
        </div>
      </div>

      {/* User Permissions Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950/80 text-neutral-400 uppercase font-mono text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="py-3 px-4">User & Universal Identity</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-2 text-center">Dashboard</th>
                <th className="py-3 px-2 text-center">Chat LVO</th>
                <th className="py-3 px-2 text-center">Status</th>
                <th className="py-3 px-2 text-center">Support</th>
                <th className="py-3 px-2 text-center">Docs</th>
                <th className="py-3 px-4 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-2 text-blue-400" />
                    Loading user permissions matrix from database...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-neutral-500">
                    No users match current search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrentSuperAdmin = u.email === 'lvo.lmarts@gmail.com';
                  const isUserAdmin = u.role === 'admin' || isCurrentSuperAdmin;
                  const perms = u.permissions || {
                    dashboard: false,
                    chat: false,
                    status: false,
                    support: false,
                    doc: false
                  };

                  return (
                    <tr 
                      key={u.uid} 
                      className={`hover:bg-neutral-800/40 transition-colors ${
                        u.uid === user?.uid ? 'bg-blue-950/10' : ''
                      }`}
                    >
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {u.photoURL ? (
                            <img src={u.photoURL} alt="" className="w-8 h-8 rounded-full border border-neutral-700" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center font-bold text-blue-400 text-xs">
                              {(u.email || 'U')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-semibold text-neutral-200 truncate flex items-center gap-1.5">
                              <span>{u.displayName || 'Cloud User'}</span>
                              {u.uid === user?.uid && (
                                <span className="text-[9px] px-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-neutral-400 font-mono truncate">{u.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role Dropdown */}
                      <td className="py-3.5 px-3">
                        {isCurrentSuperAdmin ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono text-[10px] font-bold">
                            SUPER ADMIN
                          </span>
                        ) : (
                          <select
                            disabled={!isAdmin || savingUid === u.uid}
                            value={u.role || 'member'}
                            onChange={(e) => handleChangeRole(u, e.target.value as any)}
                            className="bg-neutral-950 border border-neutral-800 text-neutral-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 font-mono"
                          >
                            <option value="admin">Admin</option>
                            <option value="developer">Developer</option>
                            <option value="member">Member</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        )}
                      </td>

                      {/* 5 Service Toggles */}
                      {(['dashboard', 'chat', 'status', 'support', 'doc'] as ServiceKey[]).map((serviceKey) => {
                        const hasAccess = isUserAdmin || Boolean(perms[serviceKey]);
                        const isLockedForAdmin = isCurrentSuperAdmin;

                        return (
                          <td key={serviceKey} className="py-3.5 px-2 text-center">
                            <button
                              type="button"
                              disabled={!isAdmin || isLockedForAdmin || savingUid === u.uid}
                              onClick={() => handleTogglePermission(u, serviceKey)}
                              title={
                                isLockedForAdmin 
                                  ? 'Root admin has perpetual access' 
                                  : hasAccess 
                                    ? `Click to revoke ${SERVICE_META[serviceKey].label}` 
                                    : `Click to grant ${SERVICE_META[serviceKey].label}`
                              }
                              className={`p-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer ${
                                hasAccess
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 shadow-sm'
                                  : 'bg-neutral-950 border-neutral-800 text-neutral-600 hover:text-neutral-400 hover:border-neutral-700'
                              } ${isLockedForAdmin ? 'opacity-80 cursor-default' : ''}`}
                            >
                              {hasAccess ? (
                                <Check className="w-4 h-4 stroke-[2.5]" />
                              ) : (
                                <X className="w-4 h-4 stroke-[2]" />
                              )}
                            </button>
                          </td>
                        );
                      })}

                      {/* Quick Actions */}
                      <td className="py-3.5 px-4 text-right">
                        {isCurrentSuperAdmin ? (
                          <span className="text-[10px] text-neutral-500 font-mono">Immutable</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleGrantAll(u)}
                              disabled={!isAdmin || savingUid === u.uid}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-emerald-950 hover:text-emerald-300 text-neutral-300 border border-neutral-700 text-[10px] font-medium transition-colors"
                            >
                              Grant All
                            </button>
                            <button
                              onClick={() => handleRevokeAll(u)}
                              disabled={!isAdmin || savingUid === u.uid}
                              className="px-2 py-1 rounded bg-neutral-800 hover:bg-red-950 hover:text-red-300 text-neutral-400 border border-neutral-700 text-[10px] font-medium transition-colors"
                            >
                              Revoke
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer info banner */}
        <div className="p-4 bg-neutral-950 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>
              All permission changes update Firestore instantaneously and propagate to active sessions.
            </span>
          </div>
          <div className="text-[11px] font-mono text-neutral-500">
            Total Users: {users.length}
          </div>
        </div>
      </div>
    </div>
  );
};
