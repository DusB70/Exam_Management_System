'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';

export default function AcademicStructurePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'departments' | 'degrees' | 'specializations'>(
    'departments',
  );

  // Search Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit'>('create');
  const [modalTarget, setModalTarget] = useState<'department' | 'degree' | 'specialization'>(
    'department',
  );
  const [selectedItem, setSelectedItem] = useState<any>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    departmentId: 0,
    degreeId: 0,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await apiClient.get('/departments');
      return res.data?.data || [];
    },
  });

  const { data: degrees = [], isLoading: loadingDegrees } = useQuery({
    queryKey: ['degrees'],
    queryFn: async () => {
      const res = await apiClient.get('/degrees');
      return res.data?.data || [];
    },
  });

  const { data: specializations = [], isLoading: loadingSpecs } = useQuery({
    queryKey: ['specializations'],
    queryFn: async () => {
      const res = await apiClient.get('/specializations');
      return res.data?.data || [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async ({ target, data }: { target: string; data: any }) => {
      return apiClient.post(`/${target}s`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          variables.target === 'specialization' ? 'specializations' : `${variables.target}s`,
        ],
      });
      // Invalidate related lists
      if (variables.target === 'degree') queryClient.invalidateQueries({ queryKey: ['degrees'] });
      setModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to create item');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ target, id, data }: { target: string; id: number; data: any }) => {
      return apiClient.put(`/${target}s/${id}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          variables.target === 'specialization' ? 'specializations' : `${variables.target}s`,
        ],
      });
      if (variables.target === 'degree') queryClient.invalidateQueries({ queryKey: ['degrees'] });
      setModalOpen(false);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || 'Failed to update item');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ target, id }: { target: string; id: number }) => {
      return apiClient.delete(`/${target}s/${id}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [
          variables.target === 'specialization' ? 'specializations' : `${variables.target}s`,
        ],
      });
      if (variables.target === 'degree') queryClient.invalidateQueries({ queryKey: ['degrees'] });
    },
    onError: (err: any) => {
      alert(
        err.response?.data?.message || 'Failed to delete item because it is referenced elsewhere.',
      );
    },
  });

  const handleOpenCreate = (target: 'department' | 'degree' | 'specialization') => {
    setModalType('create');
    setModalTarget(target);
    setErrorMsg(null);
    setFormData({
      name: '',
      code: '',
      departmentId: departments[0]?.department_id || 0,
      degreeId: degrees[0]?.degree_id || 0,
    });
    setSelectedItem(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (target: 'department' | 'degree' | 'specialization', item: any) => {
    setModalType('edit');
    setModalTarget(target);
    setErrorMsg(null);
    setSelectedItem(item);

    if (target === 'department') {
      setFormData({
        name: item.department_name,
        code: item.department_code,
        departmentId: 0,
        degreeId: 0,
      });
    } else if (target === 'degree') {
      setFormData({
        name: item.degree_name,
        code: item.degree_code,
        departmentId: item.department_id,
        degreeId: 0,
      });
    } else if (target === 'specialization') {
      setFormData({
        name: item.specialization_name,
        code: item.specialization_code,
        departmentId: 0,
        degreeId: item.degree_id,
      });
    }
    setModalOpen(true);
  };

  const handleDelete = (target: 'department' | 'degree' | 'specialization', id: number) => {
    if (confirm(`Are you sure you want to delete this ${target}? This cannot be undone.`)) {
      deleteMutation.mutate({ target, id });
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let payload: any = {};
    if (modalTarget === 'department') {
      payload = { departmentName: formData.name, departmentCode: formData.code };
    } else if (modalTarget === 'degree') {
      payload = {
        degreeName: formData.name,
        degreeCode: formData.code,
        departmentId: Number(formData.departmentId),
      };
    } else if (modalTarget === 'specialization') {
      payload = {
        specializationName: formData.name,
        specializationCode: formData.code,
        degreeId: Number(formData.degreeId),
      };
    }

    if (modalType === 'create') {
      createMutation.mutate({ target: modalTarget, data: payload });
    } else {
      const id =
        modalTarget === 'department'
          ? selectedItem.department_id
          : modalTarget === 'degree'
            ? selectedItem.degree_id
            : selectedItem.specialization_id;
      updateMutation.mutate({ target: modalTarget, id, data: payload });
    }
  };

  // Filtering lists
  const filteredDepartments = departments.filter(
    (dept: any) =>
      dept.department_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dept.department_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredDegrees = degrees.filter(
    (deg: any) =>
      deg.degree_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deg.degree_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredSpecializations = specializations.filter(
    (spec: any) =>
      spec.specialization_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      spec.specialization_code.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isLoading = loadingDepts || loadingDegrees || loadingSpecs;

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Structure</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Manage academic departments, degrees offered, and advanced specializations
          </p>
        </div>
        <button
          onClick={() =>
            handleOpenCreate(
              activeTab === 'departments'
                ? 'department'
                : activeTab === 'degrees'
                  ? 'degree'
                  : 'specialization',
            )
          }
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition shadow-lg shadow-primary/20 self-start sm:self-auto text-sm"
        >
          <Plus className="h-4.5 w-4.5" />
          Add{' '}
          {activeTab === 'departments'
            ? 'Department'
            : activeTab === 'degrees'
              ? 'Degree'
              : 'Specialization'}
        </button>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-border/80 gap-6">
        <button
          onClick={() => {
            setActiveTab('departments');
            setSearchQuery('');
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'departments'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Departments ({departments.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('degrees');
            setSearchQuery('');
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'degrees'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Degrees ({degrees.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('specializations');
            setSearchQuery('');
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'specializations'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Specializations ({specializations.length})
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-secondary/30 border border-border/80 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
        />
      </div>

      {/* Lists & Grids */}
      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></span>
            Loading structure records...
          </span>
        </div>
      ) : activeTab === 'departments' ? (
        /* Departments List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDepartments.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
              No departments found.
            </div>
          ) : (
            filteredDepartments.map((dept: any) => (
              <div
                key={dept.department_id}
                className="bg-card/25 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-primary/10 text-primary border border-primary/15 rounded-lg uppercase">
                      {dept.department_code}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit('department', dept)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete('department', dept.department_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight text-foreground">
                      {dept.department_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Established: {new Date(dept.created_at || Date.now()).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'degrees' ? (
        /* Degrees List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDegrees.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
              No degrees found.
            </div>
          ) : (
            filteredDegrees.map((deg: any) => (
              <div
                key={deg.degree_id}
                className="bg-card/25 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-lg uppercase">
                      {deg.degree_code}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit('degree', deg)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete('degree', deg.degree_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight text-foreground">
                      {deg.degree_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-none">
                      Department:{' '}
                      <strong className="text-foreground">{deg.department?.department_name}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-none">
                      Specializations:{' '}
                      <strong className="text-foreground">
                        {deg.specializations?.length || 0}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Specializations List */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpecializations.length === 0 ? (
            <div className="col-span-full text-center py-10 text-muted-foreground text-sm">
              No specializations found.
            </div>
          ) : (
            filteredSpecializations.map((spec: any) => (
              <div
                key={spec.specialization_id}
                className="bg-card/25 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/15 rounded-lg uppercase">
                      {spec.specialization_code}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenEdit('specialization', spec)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-foreground" />
                      </button>
                      <button
                        onClick={() => handleDelete('specialization', spec.specialization_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-tight text-foreground">
                      {spec.specialization_name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-2 leading-none">
                      Belongs to Degree:{' '}
                      <strong className="text-foreground">
                        {spec.degree?.degree_name} ({spec.degree?.degree_code})
                      </strong>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-none">
                      Dept:{' '}
                      <strong className="text-foreground">
                        {spec.degree?.department?.department_name}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Creation / Editing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border/80 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/5">
              <h3 className="font-bold text-lg">
                {modalType === 'create' ? 'Add' : 'Modify'}{' '}
                {modalTarget === 'department'
                  ? 'Department'
                  : modalTarget === 'degree'
                    ? 'Degree'
                    : 'Specialization'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Name
                </label>
                <input
                  type="text"
                  required
                  placeholder={`Enter ${modalTarget} full name...`}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  Code / Short Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICT, BICT, ST"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground font-mono uppercase"
                />
              </div>

              {/* Conditional selectors */}
              {modalTarget === 'degree' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Parent Department
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: Number(e.target.value) })
                    }
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  >
                    {departments.map((dept: any) => (
                      <option
                        key={dept.department_id}
                        value={dept.department_id}
                        className="bg-card"
                      >
                        {dept.department_name} ({dept.department_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalTarget === 'specialization' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Parent Degree
                  </label>
                  <select
                    value={formData.degreeId}
                    onChange={(e) => setFormData({ ...formData, degreeId: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  >
                    {degrees.map((deg: any) => (
                      <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                        {deg.degree_name} ({deg.degree_code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-xl hover:bg-secondary/90 transition text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/95 transition text-xs disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
