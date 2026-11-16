'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useToast } from '../../../hooks/use-toast';
import { useConfirm } from '../../../hooks/use-confirm';
import { useBulkSelection, runBulkDelete } from '../../../hooks/use-bulk-selection';
import { BulkDeleteButton, SelectAllCheckbox } from '../../../components/ui/bulk-delete-button';
import { useProgressiveInfiniteQuery } from '../../../hooks/use-progressive-load';
import ProgressiveLoadFooter from '../../../components/ui/progressive-load-footer';
import UserDialog from '../../../components/users/user-dialog';
import StudentImportDialog from '../../../components/users/student-import-dialog';
import { useAuthStore } from '../../../store/authStore';
import { UserRole } from '@ems/shared';
import { Search, UserPlus, Upload, X, Users, SquarePen } from 'lucide-react';

const fetchUsers = async (
  page: number,
  limit: number,
  search: string,
  roleId: string,
  status: string,
) => {
  const params: any = {
    page,
    limit,
    search: search || undefined,
    roleId: roleId || undefined,
    isActive: status === 'active' ? 'true' : status === 'inactive' ? 'false' : undefined,
  };
  const response = await apiClient.get('/users', { params });
  return response.data?.data;
};

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const toast = useToast();
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const {
    selectedIds: selectedUserIds,
    selectedCount,
    isSelected,
    toggle,
    isAllSelected,
    isIndeterminate,
    toggleAll,
    clear,
    removeFromSelection,
  } = useBulkSelection<number>();

  const getUserKey = useCallback((u: any) => u.user_id, []);

  // Fetch Users using progressive lazy loading (50 initially, then auto-load remaining slowly)
  const {
    items: users,
    total: totalUsers,
    loadedCount,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch,
  } = useProgressiveInfiniteQuery<any>({
    queryKey: ['users', search, roleFilter, statusFilter],
    queryFn: (page, limit) => fetchUsers(page, limit, search, roleFilter, statusFilter),
    getItemKey: getUserKey,
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      await apiClient.patch(`/users/${userId}/status`, { isActive });
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.isActive
          ? 'User account activated successfully.'
          : 'User account deactivated successfully.',
      );
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user status.');
    },
  });

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleToggleStatus = async (user: any) => {
    const willDeactivate = user.is_active;
    const confirmed = await confirm({
      title: willDeactivate ? 'Deactivate User Account?' : 'Activate User Account?',
      message: willDeactivate
        ? `Are you sure you want to deactivate ${user.full_name} (${user.email})? The user will be prevented from logging in.`
        : `Are you sure you want to activate ${user.full_name} (${user.email})?`,
      confirmText: willDeactivate ? 'Deactivate' : 'Activate',
      variant: willDeactivate ? 'destructive' : 'primary',
    });
    if (!confirmed) return;
    toggleStatusMutation.mutate({ userId: user.user_id, isActive: !user.is_active });
  };

  const canDeleteUser = useCallback(
    (u: any) =>
      u.user_id !== currentUser?.id &&
      !(currentUser?.role === UserRole.EXAM_DIVISION_STAFF && u.role_id === 1),
    [currentUser],
  );

  const selectableUserIds = useMemo(
    () => users.filter(canDeleteUser).map((u: any) => u.user_id),
    [users, canDeleteUser],
  );

  const handleBulkDeleteUsers = async () => {
    if (selectedCount === 0) return;
    const confirmed = await confirm({
      title: 'Delete Selected Users?',
      message: `Are you sure you want to permanently delete ${selectedCount} selected user account(s)? This cannot be undone.`,
      confirmText: `Delete (${selectedCount})`,
      variant: 'destructive',
    });
    if (!confirmed) return;

    setIsBulkDeleting(true);
    try {
      const deletedIds: number[] = [];
      const { deletedCount, failedCount, firstErrorMessage } = await runBulkDelete(
        selectedUserIds,
        async (id) => {
          await apiClient.delete(`/users/${id}`);
          deletedIds.push(id);
        },
      );
      if (deletedCount > 0) {
        toast.success(`${deletedCount} user account(s) deleted successfully.`);
        removeFromSelection(deletedIds);
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['staff-students-directory'] });
      }
      if (failedCount > 0) {
        toast.error(
          `${failedCount} account(s) could not be deleted${firstErrorMessage ? `: ${firstErrorMessage}` : '.'}`,
        );
      }
      if (failedCount === 0) clear();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    const confirmed = await confirm({
      title: 'Delete User Account?',
      message: `Are you sure you want to permanently delete ${user.full_name} (${user.email})? This action cannot be undone.`,
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!confirmed) return;

    try {
      await apiClient.delete(`/users/${user.user_id}`);
      toast.success('User account deleted successfully.');
      removeFromSelection([user.user_id]);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['staff-students-directory'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete user account.');
    }
  };

  // Helper to extract department name based on user role profile
  const getDepartmentLabel = (user: any) => {
    if (user.role_id === 4) {
      return (
        user.student?.degree?.department?.department_code ||
        user.student?.specialization?.department?.department_code ||
        user.student?.department?.department_code ||
        user.student?.degree?.department?.department_name ||
        user.student?.degree?.degree_code ||
        '-'
      );
    }
    if (user.role_id === 3) {
      return (
        user.lecturer?.department?.department_code ||
        user.lecturer?.department?.department_name ||
        '-'
      );
    }
    return '-';
  };

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Directory</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage academic students, lecturers, division staff, and administrators
          </p>
        </div>
        <div className="flex flex-wrap gap-3 self-start sm:self-auto">
          <button
            onClick={() => setImportDialogOpen(true)}
            className="px-4 py-2.5 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs flex items-center gap-2 border border-border/80 cursor-pointer shadow-sm"
          >
            <Upload className="h-4 w-4" />
            Import Students
          </button>
          <button
            onClick={handleCreate}
            className="px-4 py-2.5 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs flex items-center gap-2 shadow-lg shadow-primary/20 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Add User Account
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-card border border-border/80 p-5 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input & Count Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1 max-w-xl">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, NIC, index no, reg no, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/60 text-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
            <BulkDeleteButton
              count={selectedCount}
              isDeleting={isBulkDeleting}
              onClick={handleBulkDeleteUsers}
            />
            <div className="px-3 py-2 bg-background border border-border/80 rounded-xl text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              Showing {users.length} of {totalUsers} Records
            </div>
          </div>
        </div>

        {/* Filter Dropdowns Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Role Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
            >
              <option value="">All Roles</option>
              <option value="4">Student</option>
              <option value="3">Lecturer</option>
              <option value="2">Staff</option>
              <option value="1">Administrator</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-muted-foreground uppercase">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-secondary/40 border border-border/80 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {(roleFilter || statusFilter || search) && (
            <button
              onClick={() => {
                setRoleFilter('');
                setStatusFilter('');
                setSearch('');
              }}
              className="px-3 py-2 bg-secondary text-secondary-foreground text-xs font-bold rounded-xl hover:bg-secondary/80 transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-[11px] font-bold text-muted-foreground uppercase tracking-wider bg-secondary/15">
                <th className="px-3.5 py-3 w-10 text-center">
                  <SelectAllCheckbox
                    checked={isAllSelected(selectableUserIds)}
                    indeterminate={isIndeterminate(selectableUserIds)}
                    disabled={selectableUserIds.length === 0}
                    onChange={() => toggleAll(selectableUserIds)}
                    ariaLabel="Select all visible users"
                  />
                </th>
                <th className="px-3 py-3 w-10 text-center">#</th>
                <th className="px-4 py-3">Full Name & NIC</th>
                <th className="px-4 py-3">Email & Contact</th>
                <th className="px-4 py-3 whitespace-nowrap">Role</th>
                <th className="px-4 py-3 whitespace-nowrap">Dept</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-xs font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                      Loading user records...
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-20 text-muted-foreground">
                    No matching users found in directory
                  </td>
                </tr>
              ) : (
                users.map((user: any, idx: number) => {
                  const deletable = canDeleteUser(user);
                  return (
                    <tr
                      key={user.user_id}
                      className={`hover:bg-secondary/15 transition-colors ${
                        isSelected(user.user_id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-3.5 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected(user.user_id)}
                          disabled={!deletable}
                          onChange={() => toggle(user.user_id)}
                          aria-label={`Select ${user.full_name}`}
                          className="h-3.5 w-3.5 rounded border-border/80 accent-primary cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-muted-foreground font-bold text-xs">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-2.5 max-w-[210px]">
                        <div
                          className="font-bold text-xs text-foreground leading-snug truncate"
                          title={user.full_name}
                        >
                          {user.full_name}
                        </div>
                        {user.nic_no && (
                          <div className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5">
                            NIC: {user.nic_no}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <div
                          className="text-[11px] font-mono text-black dark:text-zinc-100 font-bold leading-snug truncate"
                          title={user.email}
                        >
                          {user.email}
                        </div>
                        {user.phone_number && (
                          <div className="text-[10px] text-muted-foreground/80 font-mono leading-none mt-0.5">
                            {user.phone_number}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap inline-flex items-center border ${
                            user.role_id === 1
                              ? 'bg-red-500/10 text-red-500 dark:text-red-400 border-red-500/25'
                              : user.role_id === 2
                                ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/25'
                                : user.role_id === 3
                                  ? 'bg-amber-500/10 text-amber-500 dark:text-amber-400 border-amber-500/25'
                                  : 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/25'
                          }`}
                        >
                          {user.role_id === 2 || user.role?.role_name === 'Exam Division Staff'
                            ? 'Staff'
                            : user.role.role_name}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs font-bold whitespace-nowrap">
                        {getDepartmentLabel(user)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                            user.is_active
                              ? 'bg-emerald-500/10 text-foreground dark:text-emerald-300 border-emerald-400/60 dark:border-emerald-500/40'
                              : 'bg-destructive/10 text-destructive border-destructive/40'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {!(
                          currentUser?.role === UserRole.EXAM_DIVISION_STAFF && user.role_id === 1
                        ) && (
                          <div className="inline-flex items-center justify-end gap-2.5 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(user)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-background border border-border/80 rounded-md text-[11px] font-bold text-foreground hover:bg-secondary/80 transition shadow-2xs cursor-pointer"
                            >
                              <SquarePen className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleToggleStatus(user)}
                              className={`text-[11px] font-bold transition cursor-pointer px-1 py-0.5 ${
                                user.is_active
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-emerald-500 hover:text-emerald-600'
                              }`}
                            >
                              {user.is_active ? 'Disable' : 'Enable'}
                            </button>
                            {deletable && (
                              <button
                                onClick={() => handleDeleteUser(user)}
                                className="text-[11px] font-bold text-red-500 hover:text-red-600 transition cursor-pointer px-1 py-0.5"
                              >
                                Delete
                              </button>
                            )}
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

        {/* Progressive Auto-Loading Footer Indicator */}
        <ProgressiveLoadFooter
          loadedCount={loadedCount}
          totalCount={totalUsers}
          isLoadingMore={isFetchingNextPage}
          hasMore={hasNextPage}
          isError={isFetchNextPageError}
          onRetry={() => fetchNextPage()}
          entityLabel="user records"
        />
      </div>

      {/* Create / Edit Dialog */}
      <UserDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        user={selectedUser}
        onSuccess={refetch}
      />

      {/* Bulk Import Dialog */}
      <StudentImportDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}
