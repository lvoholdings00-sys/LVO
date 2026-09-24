import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Activity, 
  LifeBuoy, 
  BookOpen, 
  ExternalLink, 
  Github, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  Code2, 
  Copy, 
  Check, 
  Sparkles,
  ArrowRight,
  Eye,
  Radio
} from 'lucide-react';
import type { ServiceKey } from '../types';

interface ServiceDefinition {
  key: ServiceKey;
  title: string;
  subdomain: string;
  repoUrl: string;
  repoName: string;
  description: string;
  icon: any;
  accentColor: string;
  badgeBg: string;
  defaultPort: number;
}

const SERVICES: ServiceDefinition[] = [
  {
    key: 'dashboard',
    title: 'LVO Dashboard',
    subdomain: 'dashboard.lvo-cloud.cloud',
    repoUrl: 'https://github.com/lvoholdings00-sys/LVO-Dashboard',
    repoName: 'lvoholdings00-sys/LVO-Dashboard',
    description: 'Central operational dashboard, business telemetry, analytics, and infrastructure oversight.',
    icon: LayoutDashboard,
    accentColor: 'text-blue-400',
    badgeBg: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    defaultPort: 3001
  },
  {
    key: 'chat',
    title: 'Chat LVO',
    subdomain: 'chat.lvo-cloud.cloud',
    repoUrl: 'https://github.com/lvoholdings00-sys/chatlvo',
    repoName: 'lvoholdings00-sys/chatlvo',
    description: 'Real-time internal team messaging, collaboration rooms, and direct agent discussions.',
    icon: MessageSquare,
    accentColor: 'text-emerald-400',
    badgeBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    defaultPort: 3002
  },
  {
    key: 'status',
    title: 'System Status',
    subdomain: 'status.lvo-cloud.cloud',
    repoUrl: 'https://github.com/lvoholdings00-sys/Status',
    repoName: 'lvoholdings00-sys/Status',
    description: 'Public and internal service uptime monitor, incident response, and latency metrics.',
    icon: Activity,
    accentColor: 'text-amber-400',
    badgeBg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    defaultPort: 3003
  },
  {
    key: 'support',
    title: 'Support Desk',
    subdomain: 'support.lvo-cloud.cloud',
    repoUrl: 'https://github.com/lvoholdings00-sys/support',
    repoName: 'lvoholdings00-sys/support',
    description: 'Customer ticket management, escalation workflows, triage, and resolved inquiries.',
    icon: LifeBuoy,
    accentColor: 'text-indigo-400',
    badgeBg: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
    defaultPort: 3004
  },
  {
    key: 'doc',
    title: 'Documentation Hub',
    subdomain: 'docs.lvo-cloud.cloud',
    repoUrl: 'https://github.com/lvoholdings00-sys/doc',
    repoName: 'lvoholdings00-sys/doc',
    description: 'Universal developer manuals, API specifications, runbooks, and deployment guides.',
    icon: BookOpen,
    accentColor: 'text-purple-400',
    badgeBg: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
    defaultPort: 3005
  }
];

interface Props {
  onOpenAuth: () => void;
}

export const ServiceGatewayLauncher: React.FC<Props> = ({ onOpenAuth }) => {
  const { user, profile, isAdmin, hasPermission, requestServiceAccess, logSSOEvent } = useAuth();
  const [selectedService, setSelectedService] = useState<ServiceDefinition | null>(null);
  const [showCodeModal, setShowCodeModal] = useState<ServiceDefinition | null>(null);
  const [simulatedService, setSimulatedService] = useState<ServiceDefinition | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [requestedServices, setRequestedServices] = useState<Record<string, boolean>>({});

  const handleLaunch = async (service: ServiceDefinition) => {
    if (!user) {
      onOpenAuth();
      return;
    }

    const permitted = hasPermission(service.key);
    if (!permitted) {
      alert(`Access Restricted: Your account (${user.email}) does not currently have permission to access ${service.title}.\n\nPlease request permission below.`);
      return;
    }

    // Log the successful launch handshake
    await logSSOEvent(
      service.title,
      'access_granted',
      `Universal SSO token issued for user ${user.email} -> ${service.subdomain}`
    );

    // Launch destination with universal token parameter
    const launchUrl = `https://${service.subdomain}?sso_token=${profile?.apiToken || 'active'}&uid=${user.uid}`;
    window.open(launchUrl, '_blank');
  };

  const handleSimulate = (service: ServiceDefinition) => {
    setSimulatedService(service);
  };

  const handleRequestAccess = async (service: ServiceDefinition) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    try {
      await requestServiceAccess(service.key, service.title);
      setRequestedServices(prev => ({ ...prev, [service.key]: true }));
      alert(`Access request submitted for ${service.title}! The administrator will review and grant permissions.`);
    } catch (err: any) {
      alert('Error requesting access: ' + err.message);
    }
  };

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateRepoGuardCode = (service: ServiceDefinition) => {
    return `/**
 * lvo-cloud Universal SSO & Permissions Guard
 * Place this in ${service.repoName} (index.html or root component)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBCS4fMSWdeL2p1Nxq8S41-7BMMytz7n2Y",
  authDomain: "gen-lang-client-0931726844.firebaseapp.com",
  projectId: "gen-lang-client-0931726844"
});

const auth = getAuth(app);
const db = getFirestore(app, "ai-studio-fa6fffdd-47dc-4ad0-b9a7-7cbfeb43077b");

// Universal SSO and Permission Enforcement for ${service.title}
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Redirect to central login
    window.location.href = "https://lvo-cloud.cloud?redirect=" + encodeURIComponent(window.location.href);
    return;
  }

  // Check centralized permission in Firestore
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const profile = snap.data();

  const isSuperAdmin = user.email === "lvo.lmarts@gmail.com";
  const hasAccess = isSuperAdmin || profile?.role === "admin" || Boolean(profile?.permissions?.["${service.key}"]);

  if (!hasAccess) {
    document.body.innerHTML = \`
      <div style="font-family:sans-serif;text-align:center;padding:50px;background:#0a0a0a;color:#fff;min-height:100vh;">
        <h2 style="color:#ef4444;">403 - Access Restricted to ${service.title}</h2>
        <p style="color:#a3a3a3;">Your account (\${user.email}) does not have permission for this lvo-cloud service.</p>
        <a href="https://lvo-cloud.cloud" style="display:inline-block;margin-top:20px;padding:10px 20px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">
          Request Permission on lvo-cloud.cloud
        </a>
      </div>
    \`;
    return;
  }

  console.log("Universal Access Granted for ${service.title}:", user.email);
  window.LVO_AUTHORIZED_USER = user;
});`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Connected GitHub Projects & Subdomain Gateway
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              5 Repositories Unified
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            All 5 GitHub applications share the single sign-in engine and centralized Firestore database cluster under <strong className="text-neutral-200">lvo-cloud.cloud</strong>.
          </p>
        </div>

        {user ? (
          <div className="flex items-center gap-2 text-xs bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-xl">
            <span className="text-neutral-400">Current Universal Identity:</span>
            <span className="font-semibold text-neutral-200 font-mono">{user.email}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400">
              {isAdmin ? 'ADMIN' : (profile?.role || 'MEMBER').toUpperCase()}
            </span>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Sign In to Unlock Services</span>
          </button>
        )}
      </div>

      {/* 5 GitHub Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {SERVICES.map((service) => {
          const Icon = service.icon;
          const permitted = user ? hasPermission(service.key) : false;
          const isRequested = requestedServices[service.key];

          return (
            <div
              key={service.key}
              className={`rounded-2xl border transition-all p-5 flex flex-col justify-between ${
                permitted
                  ? 'bg-neutral-900/80 border-neutral-700/80 hover:border-blue-500/60 shadow-lg'
                  : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div>
                {/* Header with Subdomain badge & Permission indicator */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-1 rounded-lg border ${service.badgeBg}`}>
                    <Icon className="w-3.5 h-3.5" />
                    <span>{service.subdomain}</span>
                  </div>

                  {user ? (
                    permitted ? (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Authorized
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-medium text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
                        <Lock className="w-3 h-3 text-amber-400" /> Restricted
                      </span>
                    )
                  ) : (
                    <span className="flex items-center gap-1 text-[11px] text-neutral-500 font-mono">
                      <Lock className="w-3 h-3" /> Locked
                    </span>
                  )}
                </div>

                {/* Title & Description */}
                <h4 className="text-base font-bold text-white flex items-center justify-between">
                  <span>{service.title}</span>
                </h4>
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed min-h-[2.5rem]">
                  {service.description}
                </p>

                {/* GitHub Repo Link */}
                <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                  <a
                    href={service.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-neutral-300 hover:text-white transition-colors truncate max-w-[80%]"
                  >
                    <Github className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono text-[11px] truncate">{service.repoName}</span>
                    <ExternalLink className="w-3 h-3 text-neutral-500 shrink-0" />
                  </a>

                  <button
                    onClick={() => setShowCodeModal(service)}
                    className="text-blue-400 hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Code2 className="w-3 h-3" /> SDK
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-neutral-800/80 flex items-center gap-2">
                {permitted ? (
                  <button
                    onClick={() => handleLaunch(service)}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    <span>Launch Subdomain</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                ) : user ? (
                  <button
                    onClick={() => handleRequestAccess(service)}
                    disabled={isRequested}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isRequested
                        ? 'bg-neutral-800 text-neutral-400 border border-neutral-700 cursor-default'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700'
                    }`}
                  >
                    {isRequested ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-amber-400" />
                        <span>Request Pending</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-blue-400" />
                        <span>Request Access</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="flex-1 py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5 border border-neutral-700 transition-all cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5 text-blue-400" />
                    <span>Sign In to Access</span>
                  </button>
                )}

                {/* In-app Simulator Preview Button */}
                <button
                  onClick={() => handleSimulate(service)}
                  title="Simulate service access check"
                  className="py-2 px-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span className="hidden sm:inline">Preview</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simulator Modal */}
      {simulatedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-neutral-100">
            <button
              onClick={() => setSimulatedService(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white font-mono text-lg"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl border ${simulatedService.badgeBg}`}>
                <simulatedService.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{simulatedService.title} - Live Subdomain Simulator</h3>
                <p className="text-xs text-neutral-400 font-mono">https://{simulatedService.subdomain}</p>
              </div>
            </div>

            {/* Simulated browser window */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950 overflow-hidden shadow-inner">
              <div className="bg-neutral-900 px-4 py-2 border-b border-neutral-800 flex items-center justify-between text-xs text-neutral-400 font-mono">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-red-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-yellow-500/80 inline-block" />
                  <span className="h-3 w-3 rounded-full bg-green-500/80 inline-block" />
                  <span className="text-[11px] text-neutral-300 ml-2">https://{simulatedService.subdomain}</span>
                </div>
                <span className="text-[10px] text-neutral-500">Universal SSL / SSO</span>
              </div>

              <div className="p-6">
                {user && hasPermission(simulatedService.key) ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-200">
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Universal Handshake Successful
                      </div>
                      <p className="text-xs text-emerald-300/80 mt-1">
                        User <strong>{user.email}</strong> is recognized across <strong>lvo-cloud.cloud</strong> with valid permission for <strong>{simulatedService.title}</strong>.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                        <span className="text-neutral-500 font-mono text-[10px] block">VERIFIED UID</span>
                        <span className="font-mono text-neutral-200">{user.uid.substring(0, 16)}...</span>
                      </div>
                      <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-lg">
                        <span className="text-neutral-500 font-mono text-[10px] block">ROLE</span>
                        <span className="font-mono text-neutral-200 uppercase">{isAdmin ? 'Super Admin' : (profile?.role || 'Member')}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-neutral-900/60 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300">
                      // {simulatedService.repoName} is now authorized to load private telemetry, documents, and chat sockets.
                    </div>
                  </div>
                ) : user ? (
                  <div className="text-center py-6 space-y-3">
                    <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-white">403 - Permission Required</h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      You are authenticated as <strong>{user.email}</strong>, but this account has not been granted access to <strong>{simulatedService.title}</strong> by the system administrator.
                    </p>
                    <button
                      onClick={() => {
                        handleRequestAccess(simulatedService);
                        setSimulatedService(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit Access Request to Admin
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <div className="h-12 w-12 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mx-auto">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="text-base font-bold text-white">Universal Sign-In Required</h4>
                    <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                      All pages on {simulatedService.subdomain} require a verified session with lvo-cloud.cloud.
                    </p>
                    <button
                      onClick={() => {
                        setSimulatedService(null);
                        onOpenAuth();
                      }}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                    >
                      Sign In with Universal Account
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSimulatedService(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs text-neutral-200"
              >
                Close Simulator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Code Integration Modal */}
      {showCodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-neutral-100 max-h-[90vh] flex flex-col">
            <button
              onClick={() => setShowCodeModal(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white font-mono text-lg"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className={`p-2 rounded-xl border ${showCodeModal.badgeBg}`}>
                <Code2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Integration Code for {showCodeModal.repoName}</h3>
                <p className="text-xs text-neutral-400">
                  Embed this snippet into this GitHub repo to bind it to lvo-cloud universal login and the centralized database.
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto my-3">
              <div className="relative">
                <button
                  onClick={() => copySnippet(generateRepoGuardCode(showCodeModal), showCodeModal.key)}
                  className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer shadow-sm z-10"
                >
                  {copiedKey === showCodeModal.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === showCodeModal.key ? 'Copied' : 'Copy Code'}
                </button>
                <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-emerald-300 overflow-x-auto leading-relaxed">
                  {generateRepoGuardCode(showCodeModal)}
                </pre>
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
              <span className="font-mono">Subdomain: {showCodeModal.subdomain}</span>
              <button
                onClick={() => setShowCodeModal(null)}
                className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
