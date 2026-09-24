import React, { useState, useEffect } from 'react';
import { db, collection, query, orderBy, limit, onSnapshot } from '../firebase';
import { Activity, ShieldCheck, Clock, Globe, ArrowRight } from 'lucide-react';
import type { SSOLog } from '../types';

export const SSOLogFeed: React.FC = () => {
  const [logs, setLogs] = useState<SSOLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'sso_logs'), limit(25));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: SSOLog[] = [];
      snapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() } as SSOLog);
      });
      // Sort in-memory
      items.sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime();
        const timeB = new Date(b.timestamp || 0).getTime();
        return timeB - timeA;
      });
      setLogs(items);
      setLoading(false);
    }, (err) => {
      console.warn('SSO log listener error:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h4 className="text-sm font-semibold text-white">Universal SSO Live Access Stream</h4>
        </div>
        <span className="text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
          Live Session Sync
        </span>
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-neutral-500">Listening for cross-page sessions...</div>
      ) : logs.length === 0 ? (
        <div className="py-6 text-center text-xs text-neutral-500">
          No cross-page logins recorded yet. Sign in or authenticate to see universal tokens active.
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {logs.map((log) => (
            <div 
              key={log.id} 
              className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800/80 flex items-center justify-between text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 font-medium text-neutral-200">
                    <span className="truncate">{log.userEmail || 'Universal User'}</span>
                    <ArrowRight className="w-3 h-3 text-neutral-500 shrink-0" />
                    <span className="text-blue-400 truncate">{log.servicePage}</span>
                  </div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {log.details || `Universal token verified for ${log.action}`}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono text-neutral-500 shrink-0 ml-2">
                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
