'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, Check, X,
  ToggleLeft, ToggleRight, MessageSquareQuote, Shuffle,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { GET_FAQ_ENTRIES } from '@/graphql/queries/faq';
import { CREATE_FAQ_ENTRY, UPDATE_FAQ_ENTRY, DELETE_FAQ_ENTRY } from '@/graphql/mutations/faq';
import { toast } from '@/components/ui/toaster';

const PAGE_SIZE = 5;

const BLANK_FORM = { question: '', answers: [''], keywords: '' };

function AnswersEditor({
  answers,
  onChange,
}: {
  answers: string[];
  onChange: (answers: string[]) => void;
}) {
  const update = (i: number, val: string) => {
    const next = [...answers];
    next[i] = val;
    onChange(next);
  };
  const remove = (i: number) => onChange(answers.filter((_, idx) => idx !== i));
  const add = () => onChange([...answers, '']);

  return (
    <div className="space-y-2">
      {answers.map((ans, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="flex-shrink-0 w-5 h-5 mt-2.5 rounded-full bg-brand/10 border border-brand/30 flex items-center justify-center text-[10px] font-bold text-brand">
            {i + 1}
          </div>
          <textarea
            value={ans}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Response option ${i + 1}…`}
            rows={2}
            className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand resize-none"
          />
          {answers.length > 1 && (
            <button
              onClick={() => remove(i)}
              className="mt-2.5 p-1 text-text-secondary hover:text-error transition-colors"
            >
              <X size={15} />
            </button>
          )}
        </div>
      ))}
      <button onClick={add} className="flex items-center gap-1.5 text-xs text-brand hover:underline mt-1">
        <Plus size={13} /> Add another response
      </button>
    </div>
  );
}

export default function FaqAdminPage() {
  const { data, loading, refetch } = useQuery(GET_FAQ_ENTRIES, { fetchPolicy: 'cache-and-network' });
  const entries: any[] = data?.faqEntries ?? [];

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(BLANK_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);

  const [createEntry, { loading: creating }] = useMutation(CREATE_FAQ_ENTRY, {
    onCompleted: () => {
      toast({ title: 'Response created', variant: 'success' });
      setForm(BLANK_FORM);
      setShowForm(false);
      refetch();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'error' }),
  });

  const [updateEntry, { loading: saving }] = useMutation(UPDATE_FAQ_ENTRY, {
    onCompleted: () => {
      toast({ title: 'Response updated', variant: 'success' });
      setEditingId(null);
      refetch();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'error' }),
  });

  const [deleteEntry] = useMutation(DELETE_FAQ_ENTRY, {
    onCompleted: () => {
      toast({ title: 'Response deleted', variant: 'success' });
      setDeletingId(null);
      const remainingCount = entries.length - 1;
      const newTotalPages = Math.ceil(remainingCount / PAGE_SIZE);
      if (page > newTotalPages && newTotalPages > 0) setPage(newTotalPages);
      refetch();
    },
    onError: (e) => toast({ title: 'Error', description: e.message, variant: 'error' }),
  });

  const validate = (f: typeof BLANK_FORM) => {
    if (!f.question.trim()) { toast({ title: 'Question is required', variant: 'error' }); return false; }
    if (!f.answers.some((a) => a.trim())) { toast({ title: 'At least one response is required', variant: 'error' }); return false; }
    return true;
  };

  const handleCreate = () => {
    if (!validate(form)) return;
    createEntry({
      variables: {
        input: {
          question: form.question.trim(),
          answers: form.answers.filter((a) => a.trim()),
          keywords: form.keywords.trim() || undefined,
        },
      },
    });
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditForm({
      question: entry.question,
      answers: entry.answers.length ? entry.answers : [''],
      keywords: entry.keywords ?? '',
    });
  };

  const handleSave = (id: string) => {
    if (!validate(editForm)) return;
    updateEntry({
      variables: {
        id,
        input: {
          question: editForm.question.trim(),
          answers: editForm.answers.filter((a: string) => a.trim()),
          keywords: editForm.keywords.trim() || undefined,
        },
      },
    });
  };

  const toggleActive = (entry: any) => {
    updateEntry({ variables: { id: entry.id, input: { isActive: !entry.isActive } } });
  };

  const paginated = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">
            Predefined <span className="gradient-text">Responses</span>
          </h1>
          <p className="text-sm text-text-secondary mt-1 hidden sm:block">
            When a customer asks a matching question, the chatbot randomly picks one of your preset responses — applies to all influencers globally.
          </p>
          <p className="text-xs text-text-secondary mt-1 sm:hidden">
            Global chatbot auto-replies, picked randomly.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="btn-brand flex items-center gap-2 flex-shrink-0 text-sm px-3 py-2 sm:px-4"
        >
          <Plus size={14} />
          <span className="hidden sm:inline">Add Question</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-card p-4 sm:p-5 mb-6 space-y-4"
          >
            <h2 className="font-semibold text-sm">New Predefined Response</h2>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Question / Trigger
              </label>
              <input
                value={form.question}
                onChange={(e) => setForm({ ...form, question: e.target.value })}
                placeholder="e.g. Hi, Hello, How are you doing?"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
              />
              <p className="text-[11px] text-text-secondary/60 mt-1">
                Describe the question or greeting this should match.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-2">
                Responses{' '}
                <span className="text-text-secondary/50 font-normal">— chatbot picks one randomly</span>
              </label>
              <AnswersEditor answers={form.answers} onChange={(answers) => setForm({ ...form, answers })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Keywords <span className="text-text-secondary/50 font-normal">(optional)</span>
              </label>
              <input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="e.g. hi, hello, hey — extra words to help matching"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleCreate}
                disabled={creating}
                className="btn-brand flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50"
              >
                <Check size={14} /> {creating ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => { setShowForm(false); setForm(BLANK_FORM); }}
                className="btn-ghost flex items-center gap-2 text-sm px-4 py-2"
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-24 rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card p-10 sm:p-12 text-center">
          <MessageSquareQuote size={36} className="mx-auto text-text-secondary/30 mb-3" />
          <p className="text-text-secondary text-sm">
            No predefined responses yet.{' '}
            <button onClick={() => setShowForm(true)} className="text-brand-light hover:underline font-medium">
              Add your first one
            </button>
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginated.map((entry) => (
              <motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`glass-card overflow-hidden transition-opacity ${!entry.isActive ? 'opacity-50' : ''}`}
              >
                {editingId === entry.id ? (
                  /* ── Edit mode ── */
                  <div className="p-4 sm:p-5 space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Question / Trigger</label>
                      <input
                        value={editForm.question}
                        onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-2">
                        Responses <span className="text-text-secondary/50 font-normal">— chatbot picks one randomly</span>
                      </label>
                      <AnswersEditor
                        answers={editForm.answers}
                        onChange={(answers) => setEditForm({ ...editForm, answers })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-text-secondary mb-1">Keywords</label>
                      <input
                        value={editForm.keywords}
                        onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-brand"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleSave(entry.id)}
                        disabled={saving}
                        className="btn-brand flex items-center gap-2 text-sm px-3 py-1.5 disabled:opacity-50"
                      >
                        <Check size={13} /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="btn-ghost flex items-center gap-2 text-sm px-3 py-1.5"
                      >
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ── View mode ── */
                  <div className="p-4 sm:p-5">
                    {/* Question + action buttons */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-medium text-sm leading-snug">{entry.question}</p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => toggleActive(entry)}
                          title={entry.isActive ? 'Disable' : 'Enable'}
                          className="p-1.5 rounded-lg hover:bg-surface transition-colors"
                        >
                          {entry.isActive
                            ? <ToggleRight size={18} className="text-success" />
                            : <ToggleLeft size={18} className="text-text-secondary" />}
                        </button>
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setDeletingId(entry.id)}
                          className="p-1.5 rounded-lg text-text-secondary hover:text-error hover:bg-error/10 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Answers */}
                    <div className="space-y-1.5 mb-3">
                      {entry.answers.map((ans: string, i: number) => (
                        <div key={i} className="flex items-start gap-2">
                          <div className="flex-shrink-0 w-4 h-4 mt-0.5 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-[9px] font-bold text-brand">
                            {i + 1}
                          </div>
                          <p className="text-text-secondary text-sm leading-relaxed">{ans}</p>
                        </div>
                      ))}
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      {entry.answers.length > 1 && (
                        <span className="flex items-center gap-1 text-[11px] text-brand/70">
                          <Shuffle size={11} /> Picks randomly from {entry.answers.length} responses
                        </span>
                      )}
                      {entry.keywords && (
                        <p className="text-[11px] text-text-secondary/50 truncate">
                          Keywords: {entry.keywords}
                        </p>
                      )}
                    </div>

                    {/* Delete confirmation */}
                    <AnimatePresence>
                      {deletingId === entry.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-error/20 flex flex-wrap items-center gap-2">
                            <p className="text-xs text-error flex-1 min-w-0">
                              Delete this response permanently?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => deleteEntry({ variables: { id: entry.id } })}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-error/10 text-error hover:bg-error/20 transition-colors"
                              >
                                Delete
                              </button>
                              <button
                                onClick={() => setDeletingId(null)}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text-secondary hover:text-text-primary transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-5">
              <p className="text-xs text-text-secondary">
                Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entries.length)} of {entries.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-brand text-white'
                        : 'border border-border text-text-secondary hover:text-text-primary hover:border-brand/50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-border text-text-secondary hover:text-text-primary hover:border-brand/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
