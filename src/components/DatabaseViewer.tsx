import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  db, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from '../firebase';
import { 
  Database, 
  Plus, 
  Trash2, 
  Layers, 
  RefreshCw, 
  Search, 
  Send, 
  FileJson, 
  Calendar,
  UserCheck,
  CheckCircle2,
  Table
} from 'lucide-react';
import type { DatabaseEntry, CloudPage } from '../types';

interface DatabaseViewerProps {
  selectedPage: CloudPage | null;
  pages: CloudPage[];
}

export const DatabaseViewer: React.FC<DatabaseViewerProps> = ({ selectedPage, pages }) => {
  const { user, profile } = useAuth();
  const [entries, setEntries] = useState<DatabaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCollection, setActiveCollection] = useState<string>('all');
  const [newCollectionName, setNewCollectionName] = useState('settings');
  const [newEntryPayload, setNewEntryPayload] = useState('{\n  "title": "Welcome Config",\n  "status": "online",\n  "theme": "dark"\n}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Real-time listener for database entries
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'database_entries'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: DatabaseEntry[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as DatabaseEntry);
      });
      // Sort in-memory to prevent complex composite index requirements
      items.sort((a, b) => {
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      setEntries(items);
      setLoading(false);
    }, (error) => {
      console.warn('Real-time database fetch error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setJsonError(null);

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(newEntryPayload);
    } catch (err: any) {
      setJsonError('Invalid JSON format: ' + err.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const targetPageId = selectedPage ? selectedPage.id : (pages[0]?.id || 'global-cloud');
      const targetPageTitle = selectedPage ? selectedPage.title : (pages[0]?.title || 'Universal Root');

      await addDoc(collection(db, 'database_entries'), {
        pageId: targetPageId,
        pageTitle: targetPageTitle,
        collection: newCollectionName.trim().toLowerCase(),
        payload: parsedPayload,
        authorUid: user.uid,
        authorEmail: user.email || 'anonymous',
        createdAt: new Date().toISOString()
      });

      // Reset form
      setNewEntryPayload('{\n  "updated": true\n}');
    } catch (err: any) {
      console.error(err);
      setJsonError(err?.message || 'Failed to write record to universal database');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Are you sure you want to delete this database entry?')) return;
    try {
      await deleteDoc(doc(db, 'database_entries', id));
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  };

  // Extract unique collection names
  const availableCollections = Array.from(new Set(entries.map(e => e.collection)));

  const filteredEntries = entries.filter(item => {
    if (activeCollection !== 'all' && item.collection !== activeCollection) return false;
    if (selectedPage && item.pageId !== selectedPage.id) return false;
    if (searchTerm) {
      const matchSearch = item.collection.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.authorEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
        JSON.stringify(item.payload).toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-blue-400" />
              Central Database Storage
            </h3>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Firestore Cloud Cluster
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-1">
            Aggregated real-time records from all connected GitHub repos & micro-pages
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-500" />
            <input
              type="text"
              placeholder="Search collections & keys..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-200 placeholder:text-neutral-500 focus:outline-none focus:border-blue-500 w-48 sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Collection Filter Tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-neutral-500 mr-1 font-mono uppercase">Collections:</span>
        <button
          onClick={() => setActiveCollection('all')}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            activeCollection === 'all'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
          }`}
        >
          All ({entries.length})
        </button>
        {availableCollections.map((col) => (
          <button
            key={col}
            onClick={() => setActiveCollection(col)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
              activeCollection === col
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
            }`}
          >
            {col} ({entries.filter(e => e.collection === col).length})
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Entries List / Data Explorer */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-blue-400" /> Loading database documents...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400">
              <Table className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-300">No database documents match this filter</p>
              <p className="text-xs text-neutral-500 mt-1">Use the panel on the right or post from your GitHub page code to store data.</p>
            </div>
          ) : (
            filteredEntries.map((entry) => (
              <div 
                key={entry.id} 
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                      {entry.collection}
                    </span>
                    <span className="text-xs text-neutral-400">
                      Page: <strong className="text-neutral-200">{entry.pageTitle || entry.pageId}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <span className="font-mono text-[11px]">
                      {entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {(user?.uid === entry.authorUid || profile?.role === 'admin') && (
                      <button
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                        title="Delete Record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* JSON Body */}
                <pre className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-emerald-400 overflow-x-auto max-h-36">
                  {JSON.stringify(entry.payload, null, 2)}
                </pre>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-neutral-500">
                  <span className="flex items-center gap-1.5">
                    <UserCheck className="w-3 h-3 text-neutral-400" />
                    Auth: <span className="font-mono text-neutral-300">{entry.authorEmail}</span>
                  </span>
                  <span className="font-mono text-neutral-600">ID: {entry.id.substring(0, 8)}...</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Database Quick Write / Test Ingestion */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 shadow-lg space-y-4 h-fit">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-semibold text-white">Universal Data Injector</h4>
          </div>
          <p className="text-xs text-neutral-400">
            Simulate a payload write from one of your GitHub pages into the shared Firestore cluster.
          </p>

          {jsonError && (
            <div className="p-2.5 rounded-lg bg-red-950/60 border border-red-800 text-xs text-red-200">
              {jsonError}
            </div>
          )}

          <form onSubmit={handleAddEntry} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">Target Collection</label>
              <input
                type="text"
                required
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                placeholder="e.g. app_config, analytics, telemetry"
                className="w-full px-3 py-1.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1">JSON Payload</label>
              <textarea
                rows={5}
                required
                value={newEntryPayload}
                onChange={(e) => setNewEntryPayload(e.target.value)}
                className="w-full p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-200 focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !user}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isSubmitting ? 'Writing...' : user ? 'Commit to Universal Database' : 'Sign In Required to Commit'}
            </button>
          </form>

          <div className="pt-3 border-t border-neutral-800 text-[11px] text-neutral-500 space-y-1">
            <div className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="w-3 h-3" />
              Cross-origin authorized
            </div>
            <p>Entries written here are immediately broadcast via WebSockets / Firestore listeners.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
