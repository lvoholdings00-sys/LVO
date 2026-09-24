import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, collection, addDoc } from '../firebase';
import { 
  GitBranch, 
  Github, 
  Globe, 
  Plus, 
  AlertCircle,
  Key
} from 'lucide-react';
import type { CloudPage, ServiceKey } from '../types';

interface AddPageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPageCreated?: () => void;
}

export const AddPageModal: React.FC<AddPageModalProps> = ({ isOpen, onClose, onPageCreated }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [deploymentUrl, setDeploymentUrl] = useState('');
  const [category, setCategory] = useState<'dashboard' | 'docs' | 'support' | 'chat' | 'status' | 'portal'>('dashboard');
  const [serviceKey, setServiceKey] = useState<ServiceKey>('dashboard');
  const [authScope, setAuthScope] = useState<'public' | 'authenticated' | 'admin_only'>('authenticated');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setSlug(val.toLowerCase().trim().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
    }
  };

  const handleGithubRepoChange = (val: string) => {
    setGithubRepo(val);
    if (!deploymentUrl) {
      const parts = val.split('/');
      if (parts.length === 2) {
        setDeploymentUrl(`https://${parts[0]}.github.io/${parts[1]}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError('You must be signed in to connect a GitHub page to the universal database.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const subdomain = `${slug}.lvo-cloud.cloud`;
      const newPage: Omit<CloudPage, 'id'> = {
        title,
        slug: slug || title.toLowerCase().replace(/\s+/g, '-'),
        description,
        category,
        githubRepo,
        githubBranch: githubBranch || 'main',
        subdomain,
        deploymentUrl: deploymentUrl || `https://${subdomain}`,
        serviceKey,
        ssoStatus: 'active',
        authScope,
        ownerUid: user.uid,
        ownerEmail: user.email || '',
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'cloud_pages'), newPage);

      await addDoc(collection(db, 'sso_logs'), {
        userId: user.uid,
        userEmail: user.email,
        servicePage: title,
        action: 'sync_db',
        timestamp: new Date().toISOString(),
        details: `Connected GitHub repository ${githubRepo} mapped to ${serviceKey} permission guard`
      });

      if (onPageCreated) onPageCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to connect page to database.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-neutral-100 max-h-[90vh] overflow-y-auto">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-neutral-400 hover:text-white text-lg font-mono"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Github className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Connect GitHub Page to lvo-cloud</h2>
            <p className="text-xs text-neutral-400">Add any repo or GitHub Pages site with universal SSO permissions</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Page / Micro-App Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Analytics Portal"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">URL Subdomain / Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="analytics"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">GitHub Repository (owner/repo) *</label>
            <div className="relative">
              <Github className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                required
                value={githubRepo}
                onChange={(e) => handleGithubRepoChange(e.target.value)}
                placeholder="e.g. lvoholdings00-sys/LVO-Dashboard"
                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Branch</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={githubBranch}
                  onChange={(e) => setGithubBranch(e.target.value)}
                  placeholder="main"
                  className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">App Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              >
                <option value="dashboard">Dashboard</option>
                <option value="chat">Chat</option>
                <option value="status">Status</option>
                <option value="support">Support</option>
                <option value="docs">Docs</option>
                <option value="portal">Portal</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Controlling Permission Key *</label>
            <div className="relative">
              <Key className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <select
                value={serviceKey}
                onChange={(e) => setServiceKey(e.target.value as ServiceKey)}
                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="dashboard">Dashboard Permission</option>
                <option value="chat">Chat Permission</option>
                <option value="status">Status Permission</option>
                <option value="support">Support Permission</option>
                <option value="doc">Doc Permission</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Deployment URL / GitHub Pages Link</label>
            <div className="relative">
              <Globe className="absolute left-3 top-2.5 w-4 h-4 text-neutral-500" />
              <input
                type="url"
                value={deploymentUrl}
                onChange={(e) => setDeploymentUrl(e.target.value)}
                placeholder="https://dashboard.lvo-cloud.cloud or https://username.github.io/repo"
                className="w-full pl-9 pr-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1">Description / Notes</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Primary purpose of this page and data collections synchronized into lvo-cloud database..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {loading ? 'Registering...' : 'Register GitHub Page & Enable SSO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
