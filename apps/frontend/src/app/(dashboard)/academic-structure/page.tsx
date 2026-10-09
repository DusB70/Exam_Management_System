'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Plus, Edit2, Trash2, Search, Clock } from 'lucide-react';

export default function AcademicStructurePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'departments' | 'degrees' | 'specializations' | 'bulk-specialization'
  >('departments');

  // Search Filters
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Specialization Assignment State
  const [bulkDegreeId, setBulkDegreeId] = useState<number>(0);
  const [bulkSpecId, setBulkSpecId] = useState<number>(0);
  const [bulkBatch, setBulkBatch] = useState<string>('');
  const [bulkStudents, setBulkStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [bulkLoading, setBulkLoading] = useState<boolean>(false);
  const [bulkAssigning, setBulkAssigning] = useState<boolean>(false);
  const [bulkMsg, setBulkMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bulkStudentSearch, setBulkStudentSearch] = useState<string>('');

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
    durationYears: 4,
    totalCreditsRequired: 0,
    compulsoryCredits: 0,
    minOptionalCredits: 0,
    establishedDate: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Semester Limits Modal State
  const [limitsModalOpen, setLimitsModalOpen] = useState(false);
  const [limitDegree, setLimitDegree] = useState<any>(null);
  const [limitsList, setLimitsList] = useState<any[]>([]);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitError, setLimitError] = useState<string | null>(null);

  // Limit Form Fields
  const [limitYear, setLimitYear] = useState<number>(2026);
  const [limitSemester, setLimitSemester] = useState<string>('Semester 1');
  const [limitCredits, setLimitCredits] = useState<number>(22);

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
      durationYears: 4,
      totalCreditsRequired: 0,
      compulsoryCredits: 0,
      minOptionalCredits: 0,
      establishedDate: new Date().toISOString().split('T')[0],
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
        durationYears: 4,
        totalCreditsRequired: 0,
        compulsoryCredits: 0,
        minOptionalCredits: 0,
        establishedDate: item.created_at
          ? new Date(item.created_at).toISOString().split('T')[0]
          : '',
      });
    } else if (target === 'degree') {
      setFormData({
        name: item.degree_name,
        code: item.degree_code,
        departmentId: item.department_id || 0,
        degreeId: 0,
        durationYears: item.duration_years || 4,
        totalCreditsRequired: item.total_credits_required || 0,
        compulsoryCredits: item.compulsory_credits || 0,
        minOptionalCredits: item.min_optional_credits || item.optional_credits_required || 0,
        establishedDate: '',
      });
    } else if (target === 'specialization') {
      setFormData({
        name: item.specialization_name,
        code: item.specialization_code,
        departmentId: item.department_id || 0,
        degreeId: item.degree_id,
        durationYears: 4,
        totalCreditsRequired: 0,
        compulsoryCredits: 0,
        minOptionalCredits: 0,
        establishedDate: '',
      });
    }
    setModalOpen(true);
  };

  const handleDelete = (target: 'department' | 'degree' | 'specialization', id: number) => {
    if (confirm(`Are you sure you want to delete this ${target}? This cannot be undone.`)) {
      deleteMutation.mutate({ target, id });
    }
  };

  const handleOpenLimits = async (degree: any) => {
    setLimitDegree(degree);
    setLimitError(null);
    setLimitsLoading(true);
    setLimitsModalOpen(true);
    setLimitYear(new Date().getFullYear());
    setLimitSemester('Semester 1');
    setLimitCredits(22);

    try {
      const res = await apiClient.get(`/degrees/${degree.degree_id}/limits`);
      setLimitsList(res.data?.data || []);
    } catch (err: any) {
      setLimitError(err.response?.data?.message || 'Failed to fetch semester limits');
    } finally {
      setLimitsLoading(false);
    }
  };

  const handleAddLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLimitError(null);
    if (!limitDegree) return;

    try {
      await apiClient.post(`/degrees/${limitDegree.degree_id}/limits`, {
        academicYear: Number(limitYear),
        semester: limitSemester,
        maxCredits: Number(limitCredits),
      });
      const updatedListRes = await apiClient.get(`/degrees/${limitDegree.degree_id}/limits`);
      setLimitsList(updatedListRes.data?.data || []);
    } catch (err: any) {
      setLimitError(err.response?.data?.message || 'Failed to configure semester limit');
    }
  };

  const handleDeleteLimit = async (limitId: number) => {
    if (!confirm('Are you sure you want to delete this credit limit?')) return;
    setLimitError(null);
    if (!limitDegree) return;

    try {
      await apiClient.delete(`/degrees/${limitDegree.degree_id}/limits/${limitId}`);
      const updatedListRes = await apiClient.get(`/degrees/${limitDegree.degree_id}/limits`);
      setLimitsList(updatedListRes.data?.data || []);
    } catch (err: any) {
      setLimitError(err.response?.data?.message || 'Failed to delete semester limit');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let payload: any = {};
    if (modalTarget === 'department') {
      payload = {
        departmentName: formData.name,
        departmentCode: formData.code,
        establishedDate: formData.establishedDate || undefined,
      };
    } else if (modalTarget === 'degree') {
      payload = {
        degreeName: formData.name,
        degreeCode: formData.code,
        durationYears: Number(formData.durationYears),
        totalCreditsRequired: Number(formData.totalCreditsRequired),
        compulsoryCredits: Number(formData.compulsoryCredits),
        minOptionalCredits: Number(formData.minOptionalCredits),
      };
    } else if (modalTarget === 'specialization') {
      payload = {
        specializationName: formData.name,
        specializationCode: formData.code,
        degreeId: Number(formData.degreeId),
        departmentId: Number(formData.departmentId) || undefined,
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
        <button
          onClick={() => {
            setActiveTab('bulk-specialization');
            setSearchQuery('');
          }}
          className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'bulk-specialization'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Bulk Assign Specialization
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
                className="bg-card/30 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-xl transition-all space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg uppercase">
                      {dept.department_code}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit('department', dept)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition text-muted-foreground hover:text-foreground"
                        title="Edit Department"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('department', dept.department_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition text-destructive"
                        title="Delete Department"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-base leading-snug text-foreground">
                      {dept.department_name}
                    </h3>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Established:</span>
                  <span className="font-medium text-foreground">
                    {new Date(dept.created_at || Date.now()).toLocaleDateString()}
                  </span>
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
                className="bg-card/30 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-xl transition-all space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badges & Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg uppercase">
                        {deg.degree_code}
                      </span>
                      <span className="text-xs font-medium px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                        {deg.duration_years || 4}{' '}
                        {Number(deg.duration_years) === 1 ? 'Year' : 'Years'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenLimits(deg)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition text-muted-foreground hover:text-foreground"
                        title="Configure Semester Limits"
                      >
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit('degree', deg)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition text-muted-foreground hover:text-foreground"
                        title="Edit Degree"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('degree', deg.degree_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition text-destructive"
                        title="Delete Degree"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Degree Name */}
                  <div>
                    <h3 className="font-bold text-base leading-snug text-foreground">
                      {deg.degree_name}
                    </h3>
                    {deg.department?.department_name && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {deg.department.department_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Credit Requirements Grid */}
                <div className="space-y-2.5 pt-3 border-t border-border/50">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-secondary/30 p-2 rounded-xl border border-border/40">
                      <span className="block text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                        Total
                      </span>
                      <span className="text-xs font-bold text-foreground mt-0.5 block">
                        {parseFloat(deg.total_credits_required || 0).toFixed(1)} Cr
                      </span>
                    </div>
                    <div className="bg-secondary/30 p-2 rounded-xl border border-border/40">
                      <span className="block text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                        Compulsory
                      </span>
                      <span className="text-xs font-bold text-emerald-400 mt-0.5 block">
                        {parseFloat(deg.compulsory_credits || 0).toFixed(1)} Cr
                      </span>
                    </div>
                    <div className="bg-secondary/30 p-2 rounded-xl border border-border/40">
                      <span className="block text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                        Min Optional
                      </span>
                      <span className="text-xs font-bold text-amber-400 mt-0.5 block">
                        {parseFloat(
                          deg.min_optional_credits || deg.optional_credits_required || 0,
                        ).toFixed(1)}{' '}
                        Cr
                      </span>
                    </div>
                  </div>

                  {/* Specializations summary row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                    <span>Specializations:</span>
                    <span className="font-semibold text-foreground bg-secondary/50 px-2 py-0.5 rounded-md text-[11px]">
                      {deg.specializations?.length || 0} Specialization
                      {deg.specializations?.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : activeTab === 'specializations' ? (
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
                className="bg-card/30 border border-border/80 rounded-2xl p-5 backdrop-blur-md flex flex-col justify-between hover:shadow-xl transition-all space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Badges & Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg uppercase">
                        {spec.specialization_code}
                      </span>
                      {spec.degree?.degree_code && (
                        <span className="text-xs font-mono font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 rounded-md uppercase">
                          {spec.degree.degree_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit('specialization', spec)}
                        className="p-1.5 bg-secondary hover:bg-secondary/80 rounded-lg transition text-muted-foreground hover:text-foreground"
                        title="Edit Specialization"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete('specialization', spec.specialization_id)}
                        className="p-1.5 bg-destructive/10 hover:bg-destructive/20 rounded-lg transition text-destructive"
                        title="Delete Specialization"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Specialization Title & Department */}
                  <div>
                    <h3 className="font-bold text-base leading-snug text-foreground">
                      {spec.specialization_name}
                    </h3>
                    {(spec.department?.department_name ||
                      spec.degree?.department?.department_name) && (
                      <p className="text-xs text-muted-foreground mt-1 font-medium">
                        {spec.department?.department_name ||
                          spec.degree?.department?.department_name}
                      </p>
                    )}
                  </div>
                </div>

                {/* Structured Details Box */}
                <div className="pt-3 border-t border-border/50 text-xs">
                  <div className="bg-secondary/30 p-2.5 rounded-xl border border-border/40 space-y-1">
                    <span className="block text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Enrolled Degree Program
                    </span>
                    <span className="font-semibold text-foreground leading-tight block">
                      {spec.degree?.degree_name}{' '}
                      {spec.degree?.degree_code ? `(${spec.degree.degree_code})` : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Bulk Specialization Assignment View */
        <div className="space-y-6">
          <div className="bg-card border border-border/80 rounded-3xl p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Bulk Specialization Allocation (Post-2.1 Semester)
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a degree program and target specialization area first, then load and select
              students who follow that specialization.
            </p>

            {bulkMsg && (
              <div
                className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
                  bulkMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                }`}
              >
                <span>{bulkMsg.text}</span>
                <button onClick={() => setBulkMsg(null)} className="hover:underline">
                  Dismiss
                </button>
              </div>
            )}

            {/* Selection Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  1. Select Degree Program
                </label>
                <select
                  value={bulkDegreeId}
                  onChange={(e) => {
                    const degId = Number(e.target.value);
                    setBulkDegreeId(degId);
                    setBulkSpecId(0);
                  }}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-medium"
                >
                  <option value={0}>Select Degree...</option>
                  {degrees.map((deg: any) => (
                    <option key={deg.degree_id} value={deg.degree_id}>
                      {deg.degree_name} ({deg.degree_code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  2. Select Target Specialization Area
                </label>
                <select
                  value={bulkSpecId}
                  onChange={(e) => setBulkSpecId(Number(e.target.value))}
                  disabled={!bulkDegreeId}
                  className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 font-medium disabled:opacity-50"
                >
                  <option value={0}>Select Specialization...</option>
                  {specializations
                    .filter((s: any) => s.degree_id === bulkDegreeId)
                    .map((spec: any) => (
                      <option key={spec.specialization_id} value={spec.specialization_id}>
                        {spec.specialization_name} ({spec.specialization_code})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  3. Batch / Academic Year (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={bulkBatch}
                    onChange={(e) => setBulkBatch(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-secondary/40 border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60"
                  />
                  <button
                    onClick={async () => {
                      if (!bulkDegreeId) return;
                      setBulkLoading(true);
                      setBulkMsg(null);
                      try {
                        const res = await apiClient.get('/specializations/eligible-students', {
                          params: { degreeId: bulkDegreeId, batch: bulkBatch || undefined },
                        });
                        if (res.data?.success) {
                          setBulkStudents(res.data.data || []);
                          setSelectedStudentIds([]);
                        }
                      } catch (err: any) {
                        setBulkMsg({
                          type: 'error',
                          text: err.response?.data?.message || 'Failed to load students',
                        });
                      } finally {
                        setBulkLoading(false);
                      }
                    }}
                    disabled={!bulkDegreeId || bulkLoading}
                    className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow hover:bg-primary/90 transition disabled:opacity-50 whitespace-nowrap"
                  >
                    {bulkLoading ? 'Loading...' : 'Load Students'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Loaded Student Table */}
          {bulkStudents.length > 0 && (
            <div className="bg-card border border-border/80 rounded-3xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/80 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-secondary/10">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    placeholder="Search loaded students..."
                    value={bulkStudentSearch}
                    onChange={(e) => setBulkStudentSearch(e.target.value)}
                    className="px-3.5 py-2 bg-background border border-border/80 rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/60 w-64"
                  />
                  <span className="text-xs text-muted-foreground font-medium">
                    {selectedStudentIds.length} of {bulkStudents.length} selected
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      if (selectedStudentIds.length === bulkStudents.length) {
                        setSelectedStudentIds([]);
                      } else {
                        setSelectedStudentIds(bulkStudents.map((s) => s.student_id));
                      }
                    }}
                    className="px-3 py-1.5 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-bold rounded-lg border border-border/60 transition"
                  >
                    {selectedStudentIds.length === bulkStudents.length
                      ? 'Deselect All'
                      : 'Select All'}
                  </button>

                  <button
                    onClick={async () => {
                      if (!bulkSpecId || selectedStudentIds.length === 0) {
                        setBulkMsg({
                          type: 'error',
                          text: 'Please select a specialization and at least one student.',
                        });
                        return;
                      }
                      setBulkAssigning(true);
                      setBulkMsg(null);
                      try {
                        const res = await apiClient.post('/specializations/bulk-assign', {
                          specializationId: bulkSpecId,
                          studentIds: selectedStudentIds,
                        });
                        if (res.data?.success) {
                          setBulkMsg({ type: 'success', text: res.data.message });
                          // refresh student list
                          const refreshRes = await apiClient.get(
                            '/specializations/eligible-students',
                            {
                              params: { degreeId: bulkDegreeId, batch: bulkBatch || undefined },
                            },
                          );
                          if (refreshRes.data?.success) {
                            setBulkStudents(refreshRes.data.data || []);
                            setSelectedStudentIds([]);
                          }
                        }
                      } catch (err: any) {
                        setBulkMsg({
                          type: 'error',
                          text: err.response?.data?.message || 'Failed to assign specialization.',
                        });
                      } finally {
                        setBulkAssigning(false);
                      }
                    }}
                    disabled={!bulkSpecId || selectedStudentIds.length === 0 || bulkAssigning}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold rounded-xl shadow-md transition disabled:opacity-50"
                  >
                    {bulkAssigning
                      ? 'Assigning...'
                      : `Assign to ${selectedStudentIds.length} Selected`}
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground uppercase font-bold bg-secondary/20">
                      <th className="px-6 py-3 w-12 text-center">Select</th>
                      <th className="px-6 py-3">Reg Number</th>
                      <th className="px-6 py-3">Full Name</th>
                      <th className="px-6 py-3">Academic Year</th>
                      <th className="px-6 py-3">Current Specialization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {bulkStudents
                      .filter(
                        (s: any) =>
                          (s.registration_number || '')
                            .toLowerCase()
                            .includes(bulkStudentSearch.toLowerCase()) ||
                          (s.user?.full_name || '')
                            .toLowerCase()
                            .includes(bulkStudentSearch.toLowerCase()),
                      )
                      .map((student: any) => {
                        const isSelected = selectedStudentIds.includes(student.student_id);
                        return (
                          <tr
                            key={student.student_id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedStudentIds(
                                  selectedStudentIds.filter((id) => id !== student.student_id),
                                );
                              } else {
                                setSelectedStudentIds([...selectedStudentIds, student.student_id]);
                              }
                            }}
                            className={`hover:bg-secondary/15 transition cursor-pointer ${
                              isSelected ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td
                              className="px-6 py-3 text-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedStudentIds([
                                      ...selectedStudentIds,
                                      student.student_id,
                                    ]);
                                  } else {
                                    setSelectedStudentIds(
                                      selectedStudentIds.filter((id) => id !== student.student_id),
                                    );
                                  }
                                }}
                                className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-3 font-mono font-bold text-primary">
                              {student.registration_number}
                            </td>
                            <td className="px-6 py-3 font-semibold text-foreground">
                              {student.user?.full_name}
                            </td>
                            <td className="px-6 py-3 font-mono text-muted-foreground">
                              {student.academic_year || 'N/A'}
                            </td>
                            <td className="px-6 py-3 font-medium">
                              {student.specialization ? (
                                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg">
                                  {student.specialization.specialization_name} (
                                  {student.specialization.specialization_code})
                                </span>
                              ) : (
                                <span className="text-muted-foreground italic">None (General)</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
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
              {modalTarget === 'department' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                    Established Date
                  </label>
                  <input
                    type="date"
                    value={formData.establishedDate}
                    onChange={(e) => setFormData({ ...formData, establishedDate: e.target.value })}
                    className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                  />
                </div>
              )}

              {modalTarget === 'degree' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Degree Duration (Years)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={10}
                      step={0.5}
                      placeholder="e.g. 4"
                      value={formData.durationYears || ''}
                      onChange={(e) =>
                        setFormData({ ...formData, durationYears: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Total Credits
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={0.5}
                        placeholder="e.g. 120.0"
                        value={formData.totalCreditsRequired ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, totalCreditsRequired: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Compulsory
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={0.5}
                        placeholder="e.g. 80.0"
                        value={formData.compulsoryCredits ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, compulsoryCredits: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                        Min Optional
                      </label>
                      <input
                        type="number"
                        required
                        min={0}
                        step={0.5}
                        placeholder="e.g. 40.0"
                        value={formData.minOptionalCredits ?? ''}
                        onChange={(e) =>
                          setFormData({ ...formData, minOptionalCredits: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                      />
                    </div>
                  </div>
                </>
              )}

              {modalTarget === 'specialization' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Parent Degree Program
                    </label>
                    <select
                      value={formData.degreeId}
                      onChange={(e) =>
                        setFormData({ ...formData, degreeId: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    >
                      {degrees.map((deg: any) => (
                        <option key={deg.degree_id} value={deg.degree_id} className="bg-card">
                          {deg.degree_name} ({deg.degree_code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                      Department
                    </label>
                    <select
                      value={formData.departmentId}
                      onChange={(e) =>
                        setFormData({ ...formData, departmentId: Number(e.target.value) })
                      }
                      className="w-full px-4 py-2.5 bg-secondary/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/60 transition text-sm text-foreground"
                    >
                      <option value={0} className="bg-card">
                        None
                      </option>
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
                </>
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
      {/* Semester limits Modal */}
      {limitsModalOpen && limitDegree && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-card border border-border/80 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-border/60 flex items-center justify-between bg-secondary/5">
              <div>
                <h3 className="font-bold text-lg">Semester Workload Limits</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configure dynamic credit limits for {limitDegree.degree_name} (
                  {limitDegree.degree_code})
                </p>
              </div>
              <button
                onClick={() => setLimitsModalOpen(false)}
                className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {limitError && (
                <div className="p-3.5 bg-destructive/10 border border-destructive/20 text-destructive text-xs rounded-xl font-medium">
                  {limitError}
                </div>
              )}

              {/* Add New Limit Form */}
              <form onSubmit={handleAddLimit} className="p-4 bg-secondary/15 rounded-2xl space-y-4">
                <h4 className="text-xs font-bold text-foreground">Configure Limit</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      Academic Year
                    </label>
                    <input
                      type="number"
                      required
                      value={limitYear}
                      onChange={(e) => setLimitYear(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      Semester
                    </label>
                    <select
                      value={limitSemester}
                      onChange={(e) => setLimitSemester(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                    >
                      <option value="Semester 1">Semester 1</option>
                      <option value="Semester 2">Semester 2</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                      Max Credits
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      step={0.5}
                      value={limitCredits}
                      onChange={(e) => setLimitCredits(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition text-xs text-foreground"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/95 transition text-xs shadow-md shadow-primary/10"
                >
                  Save / Update Limit
                </button>
              </form>

              {/* Current Limits List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-foreground">Current Configured Limits</h4>
                {limitsLoading ? (
                  <div className="text-center py-4 text-xs text-muted-foreground">
                    Loading limits...
                  </div>
                ) : limitsList.length === 0 ? (
                  <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border/80 rounded-xl">
                    No limits configured yet. (Fallback default of 22.0 credits applies)
                  </div>
                ) : (
                  <div className="border border-border/60 rounded-xl overflow-hidden shadow-inner bg-card">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-border/60 bg-secondary/15 text-muted-foreground font-bold">
                          <th className="px-4 py-2">Year</th>
                          <th className="px-4 py-2">Semester</th>
                          <th className="px-4 py-2">Max Credits</th>
                          <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-medium">
                        {limitsList.map((limit) => (
                          <tr
                            key={limit.limit_id}
                            className="hover:bg-secondary/10 transition-colors"
                          >
                            <td className="px-4 py-2 text-foreground font-bold">
                              {limit.academic_year}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">{limit.semester}</td>
                            <td className="px-4 py-2 text-foreground font-bold">
                              {limit.max_credits.toFixed(1)} Credits
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteLimit(limit.limit_id)}
                                className="p-1 hover:bg-destructive/10 hover:text-destructive rounded transition text-muted-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border/60 bg-secondary/5 flex justify-end">
              <button
                type="button"
                onClick={() => setLimitsModalOpen(false)}
                className="px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition text-xs"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
