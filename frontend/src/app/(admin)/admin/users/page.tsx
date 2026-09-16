'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Power, PowerOff, Search, Pencil, X, Save, Trash2, RotateCcw, Users, Trash, ChevronLeft, ChevronRight, Bot, Sparkles, CheckCircle, Loader2, Briefcase } from 'lucide-react';
import { useAuthStore } from '@/lib/auth';
import { toast } from '@/components/ui/toaster';
import { gql } from '@apollo/client';
import { GET_INFLUENCERS } from '@/graphql/queries/influencer';
import { ADMIN_HIRE_AGENT_FOR_USER } from '@/graphql/mutations/user';
import { ADMIN_USER_HIRED_AGENTS } from '@/graphql/queries/user';

const GET_ALL_USERS = gql`query GetAllUsers { allUsers { id name email role accountType company isActive createdAt deletedAt } }`;
const GET_TRASHED_USERS = gql`query GetTrashedUsers { trashedUsers { id name email role accountType company isActive createdAt deletedAt } }`;
const DEACTIVATE_USER = gql`mutation DeactivateUser($userId: String!) { deactivateUser(userId: $userId) { id isActive } }`;
const ACTIVATE_USER = gql`mutation ActivateUser($userId: String!) { activateUser(userId: $userId) { id isActive } }`;
const SOFT_DELETE_USER = gql`mutation SoftDeleteUser($userId: String!) { softDeleteUser(userId: $userId) { id deletedAt } }`;
const RESTORE_USER = gql`mutation RestoreUser($userId: String!) { restoreUser(userId: $userId) { id deletedAt } }`;
const ADMIN_UPDATE_USER = gql`
  mutation AdminUpdateUser($userId: String!, $input: AdminUpdateUserInput!) {
    adminUpdateUser(userId: $userId, input: $input) {
      id name email role company isActive
    }
  }
`;

const ROLES = ['CUSTOMER', 'AGENCY', 'REVIEWER', 'ADMIN'];

const ROLE_COLORS: Record<string, string> = {
  CUSTOMER: 'text-brand-light bg-brand/10',
  AGENCY: 'text-accent bg-accent/10',
  ADMIN: 'text-success bg-success/10',
  REVIEWER: 'text-text-secondary bg-surface',
};

interface EditForm { name: string; email: string; role: string; company: string; }

type Tab = 'active' | 'trash';

const ITEMS_PER_PAGE = 10;

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, isAuthenticated, hydrated } = useAuthStore();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });

  useEffect(() => {
    if (hydrated && (!isAuthenticated || user?.role !== 'ADMIN')) router.push('/dashboard');
  }, [hydrated, isAuthenticated, user]);

  const [tab, setTab] = useState<Tab>('active');
  const { data, loading, refetch } = useQuery(GET_ALL_USERS);
  const { data: trashedData, loading: trashedLoading, refetch: refetchTrashed } = useQuery(GET_TRASHED_USERS);
  const users = data?.allUsers ?? [];
  const trashedUsers = trashedData?.trashedUsers ?? [];
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: '', email: '', role: '', company: '' });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const list = tab === 'active' ? users : trashedUsers;
    const q = query.trim().toLowerCase();

    // Search only after 3 characters
    if (q.length > 0 && q.length < 3) {
      return list;
    }

    if (!q) return list;

    return list.filter((u: any) => {
      const fields = [u.name, u.email, u.role, u.accountType]
        .filter(Boolean)
        .map(String);

      return fields.some((f: string) => f.toLowerCase().includes(q));
    });
  }, [users, trashedUsers, query, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, page]);

  // Reset page when tab, query, or data changes
  useEffect(() => { setPage(1); }, [tab, query, users.length, trashedUsers.length]);

  const openEdit = (u: any) => {
    setEditingId(u.id);
    setEditForm({ name: u.name ?? '', email: u.email ?? '', role: u.role ?? 'CUSTOMER', company: u.company ?? '' });
  };

  const closeEdit = () => setEditingId(null);

  const [deactivate] = useMutation(DEACTIVATE_USER, { onCompleted: () => { toast({ title: 'User deactivated' }); refetch(); } });
  const [activate] = useMutation(ACTIVATE_USER, { onCompleted: () => { toast({ title: 'User activated', variant: 'success' }); refetch(); } });
  const [softDeleteUser] = useMutation(SOFT_DELETE_USER, {
    onCompleted: () => {
      toast({ title: 'User moved to trash', variant: 'success' });
      setConfirmDeleteId(null);
      refetch();
      refetchTrashed();
    },
    onError: (e) => toast({ title: 'Delete failed', description: e.message, variant: 'error' }),
  });
  const [restoreUser] = useMutation(RESTORE_USER, {
    onCompleted: () => {
      toast({ title: 'User restored successfully', variant: 'success' });
      refetch();
      refetchTrashed();
    },
    onError: (e) => toast({ title: 'Restore failed', description: e.message, variant: 'error' }),
  });
  const [adminUpdateUser, { loading: saving }] = useMutation(ADMIN_UPDATE_USER, {
    onCompleted: () => {
      toast({ title: 'User updated', variant: 'success' });
      closeEdit();
      refetch();
    },
    onError: (e) => toast({ title: 'Update failed', description: e.message, variant: 'error' }),
  });

  const handleSave = () => {
    const errors: string[] = [];
    if (!editForm.name.trim() || editForm.name.trim().length < 2) errors.push('Name must be at least 2 characters');
    if (!editForm.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) errors.push('A valid email is required');
    if (errors.length > 0) {
      toast({ title: 'Please fix the following', description: errors.join(' · '), variant: 'error' });
      return;
    }
    adminUpdateUser({
      variables: {
        userId: editingId,
        input: {
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          role: editForm.role,
          company: editForm.company.trim() || undefined,
        },
      },
    });
  };

  const handleTabSwitch = (nextTab: Tab) => {
    if (nextTab === tab) return;
    setTab(nextTab);
    setQuery('');
    setEditingId(null);
    setConfirmDeleteId(null);
    setPage(1);
  };

  const [hireModalOpen, setHireModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // Fetch all AI Agents
  const { data: influencersData } = useQuery(GET_INFLUENCERS, {
    variables: { filter: { limit: 100 } },
  });
  const availableAgents = useMemo(() => {
    return (influencersData?.influencers?.influencers || []).filter((i: any) => !i.deletedAt);
  }, [influencersData]);

  // Query hired agents for the selected user
  const { data: hiredAgentsData, refetch: refetchHiredAgents } = useQuery(ADMIN_USER_HIRED_AGENTS, {
    variables: { userId: selectedUser?.id || '' },
    skip: !selectedUser?.id,
    fetchPolicy: 'network-only',
  });

  const hiredAgentIds = useMemo(() => {
    const list = hiredAgentsData?.adminUserHiredAgents || [];
    return new Set(list.map((x: any) => x.influencerId));
  }, [hiredAgentsData]);

  // Mutation to hire agent
  const [hireAgent, { loading: hiringLoading }] = useMutation(ADMIN_HIRE_AGENT_FOR_USER, {
    onCompleted: (res) => {
      const result = res?.adminHireAgentForUser;
      if (result?.success) {
        toast({
          title: result.alreadyHired ? 'Agent Already Active' : 'AI Agent Hired Successfully!',
          description: result.message,
          variant: 'success',
        });
        refetch();
        if (selectedUser?.id) refetchHiredAgents();
      } else {
        toast({
          title: 'Hire Notice',
          description: result?.message || 'Could not complete hire',
        });
      }
    },
    onError: (err) => {
      toast({
        title: 'Hiring Failed',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const openDirectHireModal = (targetUser?: any) => {
    if (targetUser) {
      setSelectedUser(targetUser);
      setUserSearch(targetUser.name || targetUser.email || '');
    } else {
      setSelectedUser(null);
      setUserSearch('');
    }
    setSelectedAgent(null);
    setAgentSearch('');
    setUserDropdownOpen(false);
    setHireModalOpen(true);
  };

  const closeDirectHireModal = () => {
    setHireModalOpen(false);
    setSelectedUser(null);
    setSelectedAgent(null);
    setUserSearch('');
    setAgentSearch('');
    setUserDropdownOpen(false);
  };

  const handleDirectHire = () => {
    if (!selectedUser?.id || !selectedAgent?.id) {
      toast({ title: 'Selection required', description: 'Please select both a user and an AI Agent.', variant: 'error' });
      return;
    }
    hireAgent({
      variables: {
        userId: selectedUser.id,
        influencerId: selectedAgent.id,
      },
    });
  };

  const isLoading = tab === 'active' ? loading : trashedLoading;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-semibold">User <span className="gradient-text">Management</span></h1>
          <p className="text-sm text-text-secondary mt-1">
            {tab === 'active' ? `${users.length} registered users` : `${trashedUsers.length} users in trash`}
          </p>
        </motion.div>

        {tab === 'active' && (
          <button
            onClick={() => openDirectHireModal()}
            className="btn-brand flex items-center justify-center gap-2 text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-brand/20 transition-all hover:scale-[1.02] w-fit"
          >
            <Bot size={17} />
            <span>Direct Hire AI Agent</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div role="tablist" className="flex items-center gap-1 mb-4 p-1 bg-surface/50 border border-border rounded-xl w-fit">
        <button
          role="tab"
          aria-selected={tab === 'active'}
          onClick={() => handleTabSwitch('active')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'active'
              ? 'bg-background text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          <Users size={15} />
          Active Users
          {users.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'active' ? 'bg-brand/10 text-brand-light' : 'bg-surface text-text-secondary'
              }`}>{users.length}</span>
          )}
        </button>
        <button
          role="tab"
          aria-selected={tab === 'trash'}
          onClick={() => handleTabSwitch('trash')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'trash'
              ? 'bg-background text-text-primary shadow-sm'
              : 'text-text-secondary hover:text-text-primary'
            }`}
        >
          <Trash size={15} />
          Trash
          {trashedUsers.length > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === 'trash' ? 'bg-error/10 text-error' : 'bg-surface text-text-secondary'
              }`}>{trashedUsers.length}</span>
          )}
        </button>
      </div>

      <div className="mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'active' ? 'Search users by name, email, role' : 'Search trashed users...'}
            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card text-center py-12"
        >
          {tab === 'trash' ? (
            <>
              <Trash2 size={40} className="mx-auto text-text-secondary mb-3 opacity-40" />
              <p className="text-text-secondary text-sm">Trash is empty</p>
              <p className="text-text-secondary text-xs mt-1">Deleted users will appear here</p>
            </>
          ) : (
            <>
              <Users size={40} className="mx-auto text-text-secondary mb-3 opacity-40" />
              <p className="text-text-secondary text-sm">No users found</p>
            </>
          )}
        </motion.div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-text-secondary font-medium">User</th>
                <th className="text-left p-4 text-text-secondary font-medium hidden sm:table-cell">Role</th>
                <th className="text-left p-4 text-text-secondary font-medium hidden md:table-cell">
                  {tab === 'active' ? 'Joined' : 'Deleted'}
                </th>
                {tab === 'active' && (
                  <th className="text-left p-4 text-text-secondary font-medium">Status</th>
                )}
                <th className="text-right p-4 text-text-secondary font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((u: any) => (
                <React.Fragment key={u.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-surface/50 transition-colors">
                    <td className="p-4">
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-text-secondary">{u.email}</p>
                    </td>
                    <td className="p-4 hidden sm:table-cell">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[u.role] ?? 'text-text-secondary bg-surface'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell text-text-secondary text-xs">
                      {tab === 'active' ? fmtDate(u.createdAt) : fmtDate(u.deletedAt)}
                    </td>
                    {tab === 'active' && (
                      <td className="p-4">
                        <span className={`text-xs font-medium ${u.isActive ? 'text-success' : 'text-error'}`}>
                          {u.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    )}
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {tab === 'active' ? (
                          <>
                            <button
                              onClick={() => openDirectHireModal(u)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-brand/10 text-brand-light hover:bg-brand/20 transition-colors"
                              title={`Hire an AI Agent for ${u.name}`}
                            >
                              <Bot size={14} />
                              <span className="hidden lg:inline">Hire Agent</span>
                            </button>
                            <button
                              onClick={() => editingId === u.id ? closeEdit() : openEdit(u)}
                              className={`p-1.5 rounded-lg transition-colors ${editingId === u.id ? 'text-brand-light bg-brand/10' : 'text-text-secondary hover:text-text-primary hover:bg-surface'}`}
                              title="Edit user"
                            >
                              <Pencil size={15} />
                            </button>
                            {u.isActive ? (
                              <button onClick={() => deactivate({ variables: { userId: u.id } })}
                                className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors" title="Deactivate">
                                <PowerOff size={15} />
                              </button>
                            ) : (
                              <button onClick={() => activate({ variables: { userId: u.id } })}
                                className="p-1.5 rounded-lg text-success hover:bg-success/10 transition-colors" title="Activate">
                                <Power size={15} />
                              </button>
                            )}
                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => setConfirmDeleteId(confirmDeleteId === u.id ? null : u.id)}
                                className={`p-1.5 rounded-lg transition-colors ${confirmDeleteId === u.id
                                    ? 'text-white bg-error'
                                    : 'text-text-secondary hover:text-error hover:bg-error/10'
                                  }`}
                                title="Move to trash"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => restoreUser({ variables: { userId: u.id } })}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-success bg-success/10 hover:bg-success/20 transition-colors"
                            title="Restore user"
                          >
                            <RotateCcw size={14} />
                            Restore
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Delete confirmation row */}
                  <AnimatePresence>
                    {tab === 'active' && confirmDeleteId === u.id && (
                      <tr key={`delete-${u.id}`} className="border-b border-border bg-error/5">
                        <td colSpan={5} className="px-4 py-3">
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="flex items-center justify-between"
                          >
                            <p className="text-sm text-text-secondary">
                              Move <span className="font-medium text-text-primary">{u.name}</span> to trash? You can restore them later.
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => softDeleteUser({ variables: { userId: u.id } })}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-error hover:bg-error/90 transition-colors"
                              >
                                <Trash2 size={14} />
                                Move to Trash
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="btn-ghost flex items-center gap-1.5 text-sm px-3 py-1.5"
                              >
                                <X size={14} />
                                Cancel
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>

                  {/* Edit row */}
                  <AnimatePresence>
                    {tab === 'active' && editingId === u.id && (
                      <tr key={`edit-${u.id}`} className="border-b border-border bg-surface/30">
                        <td colSpan={5} className="px-4 pb-4 pt-2">
                          <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                          >
                            <div>
                              <label className="block text-xs font-medium text-text-secondary mb-1">Full Name</label>
                              <input
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-secondary mb-1">Email</label>
                              <input
                                value={editForm.email}
                                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                type="email"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-secondary mb-1">Role</label>
                              <select
                                value={editForm.role}
                                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                              >
                                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-text-secondary mb-1">Company</label>
                              <input
                                value={editForm.company}
                                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                                placeholder="Optional"
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                              />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-4 flex gap-2 mt-1">
                              <button onClick={handleSave} disabled={saving}
                                className="btn-brand flex items-center gap-2 text-sm px-4 py-2 disabled:opacity-50">
                                <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                              </button>
                              <button onClick={closeEdit} className="btn-ghost flex items-center gap-2 text-sm px-4 py-2">
                                <X size={14} /> Cancel
                              </button>
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-text-secondary">
                Showing {((page - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} of {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition-colors ${p === page
                        ? 'bg-brand text-white shadow-sm'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                      }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface transition-colors disabled:opacity-30 disabled:pointer-events-none"
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Hire AI Agent Modal */}
      <AnimatePresence>
        {hireModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-surface border border-border rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center text-brand-light">
                    <Bot size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Direct Hire AI Agent</h3>
                    <p className="text-xs text-text-secondary">Instantly assign any AI Agent to any user without payment or checkout</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeDirectHireModal}
                  className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface/80 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
                {/* Step 1: Select User */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                    1. Select User
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setUserDropdownOpen(true);
                      }}
                      onFocus={() => setUserDropdownOpen(true)}
                      placeholder="Search user by name or email..."
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  {/* Selected User Display */}
                  {selectedUser && (
                    <div className="mt-2.5 p-3.5 bg-brand/5 border border-brand/20 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center font-bold text-sm gradient-text">
                          {(selectedUser.name || selectedUser.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{selectedUser.name}</p>
                          <p className="text-xs text-text-secondary">
                            {selectedUser.email} · <span className={ROLE_COLORS[selectedUser.role] || ''}>{selectedUser.role}</span>
                          </p>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-brand/20 text-brand-light">
                        Target User
                      </span>
                    </div>
                  )}

                  {/* User Dropdown Suggestions */}
                  {userDropdownOpen && (
                    <div className="mt-1.5 max-h-48 overflow-y-auto bg-surface border border-border rounded-xl shadow-xl divide-y divide-border/50">
                      {users
                        .filter((u: any) =>
                          !userSearch ||
                          u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
                          u.email?.toLowerCase().includes(userSearch.toLowerCase())
                        )
                        .map((u: any) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setUserSearch(u.name || u.email);
                              setUserDropdownOpen(false);
                            }}
                            className={`w-full text-left p-3 hover:bg-background/80 transition-colors flex items-center justify-between ${
                              selectedUser?.id === u.id ? 'bg-brand/10' : ''
                            }`}
                          >
                            <div>
                              <p className="text-sm font-medium text-text-primary">{u.name}</p>
                              <p className="text-xs text-text-secondary">{u.email}</p>
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border text-text-secondary">
                              {u.role}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}

                  {/* User's Currently Hired Agents */}
                  {selectedUser && hiredAgentsData?.adminUserHiredAgents && hiredAgentsData.adminUserHiredAgents.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs text-text-secondary mb-1.5">Already Hired Agents for this user:</p>
                      <div className="flex flex-wrap gap-2">
                        {hiredAgentsData.adminUserHiredAgents.map((ha: any) => (
                          <span
                            key={ha.influencerId}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          >
                            <CheckCircle size={12} />
                            {ha.influencerName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: Select AI Agent */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">
                    2. Select AI Agent
                  </label>
                  <div className="relative mb-2.5">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                      type="text"
                      value={agentSearch}
                      onChange={(e) => setAgentSearch(e.target.value)}
                      placeholder="Search AI Agent by name or niche..."
                      className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-text-primary focus:outline-none focus:border-brand transition-colors"
                    />
                  </div>

                  {/* AI Agent Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {availableAgents
                      .filter((inf: any) =>
                        !agentSearch ||
                        inf.name?.toLowerCase().includes(agentSearch.toLowerCase()) ||
                        (inf.industries && inf.industries.some((ind: string) => ind.toLowerCase().includes(agentSearch.toLowerCase())))
                      )
                      .map((inf: any) => {
                        const isSelected = selectedAgent?.id === inf.id;
                        const isAlreadyHired = hiredAgentIds.has(inf.id);

                        return (
                          <div
                            key={inf.id}
                            onClick={() => setSelectedAgent(inf)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'border-brand bg-brand/10 ring-1 ring-brand/40'
                                : isAlreadyHired
                                ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
                                : 'border-border bg-background/50 hover:bg-background hover:border-border-hover'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-surface border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                                {inf.avatar ? (
                                  <img src={inf.avatar} alt={inf.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Bot size={18} className="text-brand-light" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{inf.name}</p>
                                <p className="text-[11px] text-text-secondary truncate">
                                  {inf.industries?.[0] || 'AI Creator'}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col items-end flex-shrink-0">
                              {isAlreadyHired ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <CheckCircle size={10} /> Active
                                </span>
                              ) : (
                                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                                  isSelected ? 'bg-brand text-white' : 'bg-surface text-text-secondary border border-border'
                                }`}>
                                  {isSelected ? 'Selected' : 'Select'}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* Assignment Summary Box */}
                {selectedUser && selectedAgent && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-xl border border-brand/20 bg-brand/5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Assignment Mode:</span>
                      <span className="font-semibold text-text-primary">Super Admin Direct Hire</span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Target User:</span>
                      <span className="font-medium text-text-primary">{selectedUser.name} ({selectedUser.email})</span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>AI Agent:</span>
                      <span className="font-medium text-brand-light">{selectedAgent.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Cost:</span>
                      <span className="font-semibold text-emerald-400">$0.00 (Direct Activation · No Checkout Required)</span>
                    </div>
                    {hiredAgentIds.has(selectedAgent.id) && (
                      <p className="text-amber-400 pt-1">
                        Notice: {selectedAgent.name} is already active for this user. Clicking Hire will reaffirm access and refresh their chat.
                      </p>
                    )}
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeDirectHireModal}
                  className="px-4 py-2 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!selectedUser || !selectedAgent || hiringLoading}
                  onClick={handleDirectHire}
                  className="btn-brand flex items-center gap-2 text-sm px-6 py-2.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-brand/20"
                >
                  {hiringLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Assigning Agent...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Hire AI Agent
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
