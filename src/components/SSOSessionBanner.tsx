import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, 
  Key, 
  ExternalLink, 
  Copy, 
  Check, 
  Terminal, 
  Code2, 
  RefreshCw, 
  LogOut, 
  Sparkles,
  Server,
  Database
} from 'lucide-react';
import type { CloudPage } from '../types';

interface SSOSessionProps {
  selectedPage?: CloudPage | null;
  onOpenAuth: () => void;
}

export const SSOSessionBanner: React.FC<SSOSessionProps> = ({ selectedPage, onOpenAuth }) => {
  const { user, profile, logout, generateNewApiToken } = useAuth();
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'snippet' | 'curl'>('status');

  const copyToClipboard = (text: string, type: 'token' | 'snippet') => {
    navigator.clipboard.writeText(text);
    if (type === 'token') {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    } else {
      setCopiedSnippet(true);
      setTimeout(() => setCopiedSnippet(false), 2000);
    }
  };

  const getIntegrationSnippet = () => {
    return `<!-- Include this in ANY GitHub Page or repo to integrate lvo-cloud universal auth -->
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
  import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
  import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";

  // Central lvo-cloud database & SSO configuration
  const app = initializeApp({
    apiKey: "AIzaSyBCS4fMSWdeL2p1Nxq8S41-7BMMytz7n2Y",
    authDomain: "gen-lang-client-0931726844.firebaseapp.com",
    projectId: "gen-lang-client-0931726844"
  });

  const auth = getAuth(app);
  const db = getFirestore(app, "ai-studio-fa6fffdd-47dc-4ad0-b9a7-7cbfeb43077b");

  // Universal session state across your GitHub pages
  onAuthStateChanged(auth, (user) => {
    if (user) {
      console.log("lvo-cloud Universal User Authenticated:", user.email);
      window.LVO_USER = user;
      document.body.classList.add("lvo-authenticated");
    } else {
      console.log("No universal session. Redirecting to lvo-cloud hub...");
    }
  });
</script>`;
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl mb-8">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/40 to-neutral-900 px-6 py-4 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white tracking-wide">
                Universal SSO Identity Engine
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                ACTIVE • lvo-cloud.cloud
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              Cross-origin single sign-on synchronizing all repositories, subdomains, and database collections
            </p>
          </div>
        </div>

        {user ? (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-white flex items-center gap-1.5 justify-end">
                {profile?.displayName || user.displayName || user.email?.split('@')[0]}
                {profile?.role === 'admin' && (
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/40 rounded px-1.5 py-0.2">
                    ADMIN
                  </span>
                )}
              </div>
              <div className="text-xs text-neutral-400 font-mono">{user.email}</div>
            </div>
            {user.photoURL ? (
              <img src={user.photoURL} alt="Profile" className="w-9 h-9 rounded-full border border-neutral-700" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                {(user.email || 'U')[0].toUpperCase()}
              </div>
            )}
            <button
              onClick={() => logout()}
              title="Sign Out"
              className="p-2 rounded-lg bg-neutral-800 hover:bg-red-950/60 hover:text-red-400 border border-neutral-700 text-neutral-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Shield className="w-4 h-4" /> Sign In with Universal SSO
          </button>
        )}
      </div>

      {/* Tabs navigation for SSO Tools */}
      <div className="px-6 border-b border-neutral-800 bg-neutral-950/50 flex gap-4 text-xs font-medium">
        <button
          onClick={() => setActiveTab('status')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'status' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Server className="w-3.5 h-3.5" /> Identity & Token Status
        </button>
        <button
          onClick={() => setActiveTab('snippet')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'snippet' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" /> GitHub Pages Integration Script
        </button>
        <button
          onClick={() => setActiveTab('curl')}
          className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === 'curl' ? 'border-blue-500 text-blue-400' : 'border-transparent text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" /> Central Database API
        </button>
      </div>

      {/* Content panel */}
      <div className="p-6">
        {activeTab === 'status' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Universal Session Card */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-xs uppercase font-mono tracking-wider text-neutral-500 block mb-1">
                SSO Cross-Origin State
              </span>
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2.5 w-2.5 rounded-full ${user ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-sm font-semibold text-neutral-200">
                  {user ? 'Universal Authenticated' : 'Session Ready / Guest'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed">
                {user 
                  ? 'All GitHub pages sharing this domain cluster recognize your UID seamlessly.'
                  : 'Log in to propagate credentials to connected lvo-cloud repositories automatically.'}
              </p>
            </div>

            {/* Universal API Access Token */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase font-mono tracking-wider text-neutral-500">
                  Universal API Key
                </span>
                {user && (
                  <button 
                    onClick={generateNewApiToken}
                    title="Rotate Key"
                    className="text-[11px] text-blue-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Rotate
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-xs bg-neutral-900 border border-neutral-800 px-2 py-1 rounded text-emerald-400 font-mono truncate flex-1">
                  {profile?.apiToken || (user ? 'lvo_live_auth_active' : 'Sign in to generate')}
                </code>
                {user && (
                  <button
                    onClick={() => copyToClipboard(profile?.apiToken || '', 'token')}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                    title="Copy Key"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 mt-2">
                Pass in <code className="text-neutral-400">X-LVO-Auth-Token</code> header for micro-services.
              </p>
            </div>

            {/* Target Page Context */}
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800">
              <span className="text-xs uppercase font-mono tracking-wider text-neutral-500 block mb-1">
                Active Repository Scope
              </span>
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-neutral-200">
                  {selectedPage ? selectedPage.title : 'Global lvo-cloud.cloud'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 truncate">
                {selectedPage?.githubRepo ? `github.com/${selectedPage.githubRepo}` : 'Synced with Central Firestore Cluster'}
              </p>
              {selectedPage?.deploymentUrl && (
                <a
                  href={selectedPage.deploymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 text-xs text-blue-400 hover:underline inline-flex items-center gap-1"
                >
                  Visit Deployment <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === 'snippet' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-neutral-400">
                Paste this script into the <code className="text-neutral-300">&lt;head&gt;</code> of each GitHub page or HTML site to give it instant universal login & Firestore sync:
              </p>
              <button
                onClick={() => copyToClipboard(getIntegrationSnippet(), 'snippet')}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 cursor-pointer"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedSnippet ? 'Copied Snippet!' : 'Copy Code'}
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed max-h-56">
              {getIntegrationSnippet()}
            </pre>
          </div>
        )}

        {activeTab === 'curl' && (
          <div className="space-y-3">
            <p className="text-xs text-neutral-400">
              Query or write into the central database from automated GitHub Actions, CI/CD, or background scripts:
            </p>
            <pre className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-xs font-mono text-neutral-300 overflow-x-auto">
{`# 1. Write an entry to the universal database
curl -X POST "https://firestore.googleapis.com/v1/projects/gen-lang-client-0931726844/databases/ai-studio-fa6fffdd-47dc-4ad0-b9a7-7cbfeb43077b/documents/database_entries" \\
  -H "Authorization: Bearer <FIREBASE_ID_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "fields": {
      "pageId": {"stringValue": "dashboard-main"},
      "collection": {"stringValue": "metrics"},
      "authorUid": {"stringValue": "${user ? user.uid : 'USER_UID'}"}
    }
  }'`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
