'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, X, Search, Edit2, Trash2, Check, Lock,
  Sparkles, Clock, AlertCircle
} from 'lucide-react';
import { GET_CHAT_NOTES } from '@/graphql/queries/chat';
import {
  CREATE_CHAT_NOTE,
  UPDATE_CHAT_NOTE,
  DELETE_CHAT_NOTE,
} from '@/graphql/mutations/chat';
import { toast } from '@/components/ui/toaster';

interface ChatNotesPanelProps {
  chatId: string | null;
  isOpen: boolean;
  onClose: () => void;
  influencerName?: string;
}

interface Note {
  id: string;
  chatId: string;
  userId: string;
  title?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function formatNoteDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ChatNotesPanel({
  chatId,
  isOpen,
  onClose,
  influencerName = 'conversation',
}: ChatNotesPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, loading, refetch } = useQuery(GET_CHAT_NOTES, {
    variables: { chatId: chatId || '' },
    skip: !chatId || !isOpen,
    fetchPolicy: 'cache-and-network',
  });

  const notes: Note[] = data?.chatNotes ?? [];

  const [createNote, { loading: creating }] = useMutation(CREATE_CHAT_NOTE, {
    onCompleted: () => {
      toast({ title: 'Note saved', description: 'Private note added successfully.' });
      setNewTitle('');
      setNewContent('');
      setIsCreating(false);
      refetch();
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message || 'Failed to save note.', variant: 'destructive' });
    },
  });

  const [updateNote, { loading: updating }] = useMutation(UPDATE_CHAT_NOTE, {
    onCompleted: () => {
      toast({ title: 'Note updated', description: 'Changes saved successfully.' });
      setEditingId(null);
      refetch();
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message || 'Failed to update note.', variant: 'destructive' });
    },
  });

  const [deleteNote, { loading: deleting }] = useMutation(DELETE_CHAT_NOTE, {
    onCompleted: () => {
      toast({ title: 'Note deleted', description: 'Note removed.' });
      setDeleteConfirmId(null);
      refetch();
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message || 'Failed to delete note.', variant: 'destructive' });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !chatId) return;
    createNote({
      variables: {
        chatId,
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
      },
    });
  };

  const handleStartEdit = (note: Note) => {
    setEditingId(note.id);
    setEditTitle(note.title || '');
    setEditContent(note.content);
    setDeleteConfirmId(null);
  };

  const handleSaveEdit = (noteId: string) => {
    if (!editContent.trim()) return;
    updateNote({
      variables: {
        noteId,
        title: editTitle.trim() || undefined,
        content: editContent.trim(),
      },
    });
  };

  const handleDelete = (noteId: string) => {
    deleteNote({ variables: { noteId } });
  };

  const filteredNotes = notes.filter((n) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      n.content.toLowerCase().includes(q)
    );
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 xl:hidden"
          />

          {/* Upwork-style Notes Panel Drawer */}
          <motion.aside
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[380px] bg-surface border-l border-border shadow-2xl flex flex-col h-full overflow-hidden"
          >
            {/* Panel Header */}
            <div className="p-4 border-b border-border bg-surface/90 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-text-primary flex items-center gap-1.5">
                    Private Notes
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand/10 text-brand-light border border-brand/20">
                      <Lock size={9} /> Private
                    </span>
                  </h3>
                  <p className="text-[11px] text-text-secondary truncate max-w-[200px]">
                    Only visible to you for {influencerName}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                title="Close Notes"
              >
                <X size={18} />
              </button>
            </div>

            {/* Subheader Banner */}
            <div className="px-4 py-2 bg-background/60 border-b border-border/80 text-[11px] text-text-secondary flex items-center gap-1.5 flex-shrink-0">
              <Sparkles size={13} className="text-brand-light flex-shrink-0" />
              <span>Keep track of campaign agreements, deliverables & reminders.</span>
            </div>

            {/* Actions & Search Bar */}
            <div className="p-3 border-b border-border bg-surface flex items-center gap-2 flex-shrink-0">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-2.5 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-2 text-text-secondary hover:text-text-primary"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {!isCreating && (
                <button
                  onClick={() => setIsCreating(true)}
                  className="btn-brand flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg flex-shrink-0 font-medium shadow-xs"
                >
                  <Plus size={14} /> New
                </button>
              )}
            </div>

            {/* Note List / Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* New Note Form */}
              <AnimatePresence>
                {isCreating && (
                  <motion.form
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: 'auto', y: 0 }}
                    exit={{ opacity: 0, height: 0, y: -10 }}
                    onSubmit={handleCreate}
                    className="p-3.5 rounded-xl border border-brand/40 bg-surface shadow-md space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <FileText size={13} className="text-brand-light" /> New Note
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="text-text-secondary hover:text-text-primary text-xs"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <input
                      type="text"
                      placeholder="Title (optional)..."
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand"
                    />

                    <textarea
                      placeholder="Write your private note here (e.g., agreed rate $250, video draft by Friday)..."
                      value={newContent}
                      onChange={(e) => setNewContent(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand resize-none"
                      required
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsCreating(false)}
                        className="px-3 py-1 text-xs text-text-secondary hover:bg-background rounded-md transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating || !newContent.trim()}
                        className="btn-brand px-3.5 py-1 text-xs rounded-md font-medium disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check size={13} /> {creating ? 'Saving...' : 'Save Note'}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Notes List */}
              {loading && notes.length === 0 ? (
                <div className="py-8 text-center text-xs text-text-secondary space-y-2">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading private notes...</p>
                </div>
              ) : filteredNotes.length === 0 ? (
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-surface border border-border flex items-center justify-center mx-auto text-text-secondary">
                    <FileText size={22} className="opacity-60" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-text-primary">
                      {searchQuery ? 'No matching notes found' : 'No notes created yet'}
                    </h4>
                    <p className="text-[11px] text-text-secondary mt-1 max-w-[240px] mx-auto">
                      {searchQuery
                        ? 'Try searching with a different term.'
                        : 'Add private notes to record important details, requirements, or reminders.'}
                    </p>
                  </div>
                  {!searchQuery && !isCreating && (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="btn-ghost text-xs px-3.5 py-1.5 rounded-lg inline-flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add First Note
                    </button>
                  )}
                </div>
              ) : (
                filteredNotes.map((note) => {
                  const isEditing = editingId === note.id;
                  const isDeleting = deleteConfirmId === note.id;

                  if (isEditing) {
                    return (
                      <div
                        key={note.id}
                        className="p-3.5 rounded-xl border border-brand/50 bg-surface shadow-sm space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-text-primary">Edit Note</span>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-text-secondary hover:text-text-primary text-xs"
                          >
                            <X size={14} />
                          </button>
                        </div>

                        <input
                          type="text"
                          placeholder="Title (optional)..."
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand"
                        />

                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-brand resize-none"
                          required
                        />

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 text-xs text-text-secondary hover:bg-background rounded-md transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={updating || !editContent.trim()}
                            className="btn-brand px-3.5 py-1 text-xs rounded-md font-medium disabled:opacity-50 flex items-center gap-1"
                          >
                            <Check size={13} /> {updating ? 'Updating...' : 'Update Note'}
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-xl bg-surface border border-border hover:border-brand/30 transition-all shadow-xs group relative space-y-1.5"
                    >
                      {/* Delete Confirmation Overlay inside card */}
                      {isDeleting ? (
                        <div className="space-y-2 p-1">
                          <p className="text-xs font-medium text-text-primary flex items-center gap-1.5">
                            <AlertCircle size={14} className="text-error" /> Delete this note?
                          </p>
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => handleDelete(note.id)}
                              disabled={deleting}
                              className="px-3 py-1 rounded bg-error text-white text-xs font-semibold hover:bg-error/90 transition-colors"
                            >
                              {deleting ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="px-3 py-1 rounded bg-background border border-border text-text-secondary text-xs hover:text-text-primary transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Note Header */}
                          <div className="flex items-start justify-between gap-2">
                            {note.title ? (
                              <h4 className="text-xs font-semibold text-text-primary leading-tight">
                                {note.title}
                              </h4>
                            ) : (
                              <span className="text-[10px] text-text-secondary/70 font-mono italic">
                                Untitled Note
                              </span>
                            )}

                            {/* Actions on hover */}
                            <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleStartEdit(note)}
                                className="p-1 rounded text-text-secondary hover:text-text-primary hover:bg-background transition-colors"
                                title="Edit note"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(note.id)}
                                className="p-1 rounded text-text-secondary hover:text-error hover:bg-background transition-colors"
                                title="Delete note"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Note Body */}
                          <p className="text-xs text-text-primary leading-relaxed whitespace-pre-wrap">
                            {note.content}
                          </p>

                          {/* Note Footer Timestamp */}
                          <div className="flex items-center justify-between pt-1 text-[10px] text-text-secondary/80 border-t border-border/40">
                            <span className="flex items-center gap-1">
                              <Clock size={10} /> {formatNoteDate(note.createdAt)}
                            </span>
                            {note.updatedAt !== note.createdAt && (
                              <span className="italic">Edited</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer info */}
            <div className="p-3 border-t border-border bg-surface/90 text-center flex-shrink-0">
              <p className="text-[10px] text-text-secondary flex items-center justify-center gap-1">
                <Lock size={10} className="text-brand-light" /> Private to your account · Notes are never shared with others
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
