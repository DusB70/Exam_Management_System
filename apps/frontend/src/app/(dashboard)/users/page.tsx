'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import UserDialog from '../../../components/users/user-dialog';
import StudentImportDialog from '../../../components/users/student-import-dialog';
import { Search, UserPlus, ChevronLeft, ChevronRight, Upload } from 'lucide-react';

const fetchUsers = async (page: number, search: string, roleId: string, status: string) => {
  const params: any = {
    page,
    limit: 10,
    search: search || undefined,
    roleId: roleId || undefined,
    isActive: status === 'active' ? 'true' : status === 'inactive' ? 'false' : undefined,
  };
  const response = await apiClient.get('/users', { params });
  return response.data?.data;
};

export default function UsersManagementPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Fetch Users using React Query
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['users', page, search, roleFilter, statusFilter],
    queryFn: () => fetchUsers(page, search, roleFilter, statusFilter),
  });

  // Toggle user status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      await apiClient.patch(`/users/${userId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
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

  const handleToggleStatus = (userId: number, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ userId, isActive: !currentStatus });
  };

  // Helper to extract department name based on user role profile
  const getDepartmentLabel = (user: any) => {
    if (user.role_id === 4 && user.student?.department) {
      return `${user.student.department.department_code}`;
    }
    if (user.role_id === 3 && user.lecturer?.department) {
      return `${user.lecturer.department.department_code}`;
    }
    return '-';
  };

  const users = data?.items || [];
  const totalPages = data?.totalPages || 1;

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
            className="inline-flex items-center gap-2 px-5 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition border border-border/80 text-sm"
          >
            <Upload className="h-4.5 w-4.5" />
            Import Students
          </button>
          <button
            onClick={handleCreate}
            className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 text-sm"
          >
            <UserPlus className="h-4.5 w-4.5" />
            Add User Account
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-card/20 border border-border/60 p-4 rounded-2xl backdrop-blur-md">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
          />
        </div>

        <div>
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
          >
            <option value="">All Roles</option>
            <option value="4">Student</option>
            <option value="3">Lecturer</option>
            <option value="2">Exam Division Staff</option>
            <option value="1">Administrator</option>
          </select>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-card/25 border border-border/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/80 text-xs font-bold text-muted-foreground uppercase bg-secondary/15">
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Dept</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60 text-sm font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
                      Loading user records...
                    </span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-muted-foreground">
                    No matching users found in directory
                  </td>
                </tr>
              ) : (
                users.map((user: any) => (
                  <tr key={user.user_id} className="hover:bg-secondary/15 transition-colors">
                    <td className="px-6 py-4.5 font-semibold text-foreground">{user.full_name}</td>
                    <td className="px-6 py-4.5 text-muted-foreground">{user.email}</td>
                    <td className="px-6 py-4.5 text-xs">
                      <span
                        className={`px-2.5 py-1 rounded-full font-bold ${
                          user.role_id === 1
                            ? 'bg-red-500/10 text-red-400 border border-red-500/15'
                            : user.role_id === 2
                              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/15'
                              : user.role_id === 3
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                        }`}
                      >
                        {user.role.role_name}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 font-mono text-xs">{getDepartmentLabel(user)}</td>
                    <td className="px-6 py-4.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.is_active ? 'bg-emerald-400' : 'bg-destructive'
                          }`}
                        />
                        {user.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right space-x-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-3 py-1.5 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/90 transition text-xs font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(user.user_id, user.is_active)}
                        className={`px-3 py-1.5 rounded-lg transition text-xs font-semibold ${
                          user.is_active
                            ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-border/80 flex items-center justify-between bg-secondary/10">
            <span className="text-xs font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="p-1.5 bg-secondary hover:bg-secondary/90 disabled:opacity-40 text-foreground rounded-lg transition border border-border/60"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
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
