import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Github, 
  ExternalLink, 
  Shield, 
  Trash2, 
  Edit, 
  CheckCircle, 
  Layers, 
  Radio, 
  Lock, 
  Code,
  ArrowUpRight,
  GitCommit
} from 'lucide-react';
import type { CloudPage } from '../types';

interface PageCardProps {
  page: CloudPage;
  isSelected: boolean;
  onSelect: (page: CloudPage) => void;
  onDelete: (id: string) => void;
  onTestUniversalLogin: (page: CloudPage) => void;
}

export const PageCard: React.FC<PageCardProps> = ({ 
  page, 
  isSelected, 
  onSelect, 
  onDelete,
  onTestUniversalLogin 
}) => {
  const { user, profile } = useAuth();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const canManage = user && (user.uid === page.ownerUid || profile?.role === 'admin' || user.email === 'lvo.lmarts@gmail.com');

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(page.deploymentUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div 
      onClick={() => onSelect(page)}
      className={`group relative rounded-2xl border p-5 transition-all cursor-pointer ${
        isSelected 
          ? 'bg-neutral-900/90 border-blue-500 shadow-xl shadow-blue-500/10 ring-1 ring-blue-500/50' 
          : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80 shadow-md'
      }`}
    >
      {/* Category badge and status indicator */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
            {page.category}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            SSO Universal
          </span>
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canManage && (
            <button
              onClick={() => onDelete(page.id)}
              title="Disconnect Repo"
              className="text-neutral-500 hover:text-red-400 p-1 rounded-md transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Title & Slug */}
      <h3 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors flex items-center justify-between">
        <span>{page.title}</span>
        <ArrowUpRight className="w-4 h-4 text-neutral-500 group-hover:text-blue-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </h3>

      <p className="text-xs text-neutral-400 mt-1 line-clamp-2 min-h-[2rem]">
        {page.description || 'GitHub integrated micro-page connected to central lvo-cloud database.'}
      </p>

      {/* Repo details */}
      <div className="mt-4 pt-3 border-t border-neutral-800/80 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
          <span className="flex items-center gap-1.5 text-neutral-300 truncate max-w-[70%]">
            <Github className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <span className="truncate">{page.githubRepo}</span>
          </span>
          <span className="text-neutral-500 text-[11px]">{page.githubBranch || 'main'}</span>
        </div>

        <div className="flex items-center justify-between text-[11px]">
          <span className="text-neutral-500 truncate max-w-[65%] font-mono">
            {page.deploymentUrl}
          </span>
          <button
            onClick={copyUrl}
            className="text-blue-400 hover:underline text-[10px]"
          >
            {copiedUrl ? 'Copied' : 'Copy URL'}
          </button>
        </div>
      </div>

      {/* Universal Sign-In Action Bar */}
      <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onTestUniversalLogin(page)}
          className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-neutral-700 transition-colors"
        >
          <Shield className="w-3 h-3 text-blue-400" />
          Test Universal Auth
        </button>

        <a
          href={page.deploymentUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors"
          title="Open GitHub Page in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
};
