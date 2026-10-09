import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDateInTaipei, formatDateTimeInTaipei, getDateKeyInTaipei } from "@/lib/dateHelpers";
import { redirectToAdminDashboardAfterLogin } from "@/lib/adminRedirect";
import { DEFAULT_SLOT_PRESETS, createProjectSlug } from "@/lib/adminConfig";
import { buildBookingLinkUrlMap, filterResidentsByProject, findUnbookedResidentsForProject } from "@/lib/adminDashboard";
import { downloadBookingListWorkbook } from "@/lib/bookingExport";
import { getProjectsForCompany, parsePositiveId, validateResidentForm } from "@/lib/adminForms";
import { buildPresetSlotPayloads, createEditableSlotPresets, createEmptySlotForm, filterSlotsByLink, getLinksForProject, validateSingleSlotForm } from "@/lib/slotForms";
import { validateBookingLinkForm } from "@/lib/linkForm";
import { buildCompanyFormFromRecord, createEmptyCompanyForm } from "@/lib/companyEditor";
import { CUSTOM_DATE_OPTION_VALUE, CUSTOM_SLOT_OPTION_VALUE, getTaipeiTodayDateKey, validateAdminCustomTimeRange } from "@/lib/adminCustomReschedule";
import { useRescheduleAvailabilitySync } from "@/hooks/useRescheduleAvailabilitySync";
import { trpc } from "@/lib/trpc";
import { AdminRescheduleFields } from "@/components/AdminRescheduleFields";
import { AdminAssistedBookingFields } from "@/components/AdminAssistedBookingFields";
import { AdminBookingRecordsTable } from "@/components/AdminBookingRecordsTable";
import { AdminStatisticsPanel } from "@/components/AdminStatisticsPanel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LockKeyhole, Building2, CalendarRange, ClipboardList, Users, ArrowRightLeft, ArrowLeft, Copy, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
const formatDateTime = formatDateTimeInTaipei;
const formatDateOnly = formatDateInTaipei;
const getDateKey = getDateKeyInTaipei;

function formatDateTimeInput(value: string | number | Date) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseFaq(input: string) {
  return input
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [question, ...answerParts] = line.split("|");
      return {
        question: question?.trim() || "未命名問題",
        answer: answerParts.join("|").trim() || "請補充回答",
      };
    });
}

function createEmptyLinkForm() {
  return {
    id: undefined as number | undefined,
    companyId: "",
    projectId: "",
    type: "initial",
    isEnabled: true,
    startsAt: "",
    endsAt: "",
  };
}

function createEmptyResidentForm() {
  return {
    id: undefined as number | undefined,
    companyId: "",
    projectId: "",
    unitNumber: "",
    phoneNumber: "",
    name: "",
  };
}

export default function AdminPage() {

  const utils = trpc.useUtils();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [activeTab, setActiveTab] = useState("companies");
  const [companyForm, setCompanyForm] = useState(createEmptyCompanyForm());
  const [projectForm, setProjectForm] = useState({
    companyId: "",
    name: "",
    unitFormatHint: "",
    houseNumberExample: "",
    address: "",
  });
  const [residentForm, setResidentForm] = useState(createEmptyResidentForm());
  const [residentFormMode, setResidentFormMode] = useState<"new" | "edit" | "add-contact">("new");
  const [linkForm, setLinkForm] = useState(createEmptyLinkForm());
  const [slotForm, setSlotForm] = useState(createEmptySlotForm());
  const [selectedSlotLinkId, setSelectedSlotLinkId] = useState("");
  const [editableSlotPresets, setEditableSlotPresets] = useState(createEditableSlotPresets());
  const [bookingFilters, setBookingFilters] = useState({ projectId: "", linkId: "", unitNumber: "", bookingType: "all", status: "all", bookingDate: "" });
  const [showUnbookedResidents, setShowUnbookedResidents] = useState(false);
  const [rescheduleForm, setRescheduleForm] = useState({ bookingId: "", currentSlotId: "", slotDate: "", customDate: "", newSlotId: "", customTimeRange: "", note: "", hasInspectionCompany: false });
  const [assistedBookingForm, setAssistedBookingForm] = useState({ residentId: "", linkId: "", slotDate: "", customDate: "", slotId: "", customTimeRange: "", note: "", gmail: "", hasInspectionCompany: false });
  const [residentListProjectId, setResidentListProjectId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<null | { type: "company" | "project" | "resident" | "link" | "slot"; id: number; label: string; step: 1 | 2 }>(null);
  const [isDownloadingBookingList, setIsDownloadingBookingList] = useState(false);
  const rescheduleSubmitLockedRef = useRef(false);

  const adminProfile = trpc.adminAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const dashboardQuery = trpc.admin.dashboard.useQuery(undefined, {
    enabled: Boolean(adminProfile.data),
    refetchOnWindowFocus: false,
  });

  const bookingQuery = trpc.admin.searchBookings.useQuery(
    {
      projectId: bookingFilters.projectId ? Number(bookingFilters.projectId) : undefined,
      linkId: bookingFilters.linkId ? Number(bookingFilters.linkId) : undefined,
      unitNumber: bookingFilters.unitNumber || undefined,
      bookingType: bookingFilters.bookingType === "all" ? undefined : (bookingFilters.bookingType as "initial" | "reinspect"),
      status: bookingFilters.status === "all" ? undefined : (bookingFilters.status as "booked" | "rescheduled" | "cancelled"),
      bookingDate: bookingFilters.bookingDate || undefined,
    },
    {
      enabled: Boolean(adminProfile.data),
      refetchOnWindowFocus: false,
    }
  );

  const rescheduleAvailabilityQuery = trpc.admin.rescheduleAvailability.useQuery(
    { bookingId: Number(rescheduleForm.bookingId) },
    {
      enabled: Boolean(adminProfile.data && rescheduleForm.bookingId),
      refetchOnWindowFocus: false,
    }
  );

  const bookingAvailabilityQuery = trpc.admin.bookingAvailability.useQuery(
    { linkId: Number(assistedBookingForm.linkId) },
    {
      enabled: Boolean(adminProfile.data && assistedBookingForm.linkId),
      refetchOnWindowFocus: false,
    }
  );

  const companies = dashboardQuery.data?.companies ?? [];
  const projects = dashboardQuery.data?.projects ?? [];
  const links = dashboardQuery.data?.links ?? [];
  const inspectionLinks = links.filter(link => link.mode === "inspection");
  const slots = dashboardQuery.data?.slots ?? [];
  const residents = dashboardQuery.data?.residents ?? [];
  const bookings = bookingQuery.data ?? [];
  const dashboardBookings = dashboardQuery.data?.bookings ?? [];

  const loginMutation = trpc.adminAuth.login.useMutation({
    onSuccess: async () => {
      toast.success("管理員登入成功，正在進入後台管理...");
      await redirectToAdminDashboardAfterLogin(utils);
    },
    onError: error => toast.error(error.message),
  });

  const logoutMutation = trpc.adminAuth.logout.useMutation({
    onSuccess: async () => {
      toast.success("已登出管理後台");
      await adminProfile.refetch();
    },
  });

  const refreshAll = async () => {
    await Promise.all([
      utils.admin.dashboard.invalidate(),
      utils.admin.searchBookings.invalidate(),
      utils.admin.bookingAvailability.invalidate(),
      utils.admin.rescheduleAvailability.invalidate(),
      adminProfile.refetch(),
    ]);
  };

  const companyMutation = trpc.admin.saveCompany.useMutation({
    onSuccess: async () => {
      toast.success("公司資料已儲存");
      await refreshAll();
      setCompanyForm(createEmptyCompanyForm());
    },
    onError: error => toast.error(error.message),
  });

  const projectMutation = trpc.admin.saveProject.useMutation({
    onSuccess: async () => {
      toast.success("建案資料已儲存");
      await refreshAll();
      setProjectForm({ companyId: "", name: "", unitFormatHint: "", houseNumberExample: "", address: "" });
    },
    onError: error => toast.error(error.message),
  });

  const residentMutation = trpc.admin.saveResident.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.id ? "住戶聯絡資料已更新" : "住戶聯絡資料已儲存");
      await refreshAll();
      setResidentForm(createEmptyResidentForm());
      setResidentFormMode("new");
    },
    onError: error => {
      const isMissingSelectionError = error.message.includes("companyId") || error.message.includes("projectId");
      toast.error(isMissingSelectionError ? "請先選擇公司與建案，再儲存住戶資料" : error.message);
    },
  });

  const linkMutation = trpc.admin.saveLink.useMutation({
    onSuccess: async () => {
      toast.success("預約連結已產生或更新，請在下方直接複製分享網址給客戶");
      await refreshAll();
      setLinkForm(createEmptyLinkForm());
    },
    onError: error => toast.error(error.message),
  });

  const slotMutation = trpc.admin.saveSlot.useMutation({
    onSuccess: async () => {
      toast.success("時段已儲存");
      await refreshAll();
      setEditableSlotPresets(createEditableSlotPresets());
      setSlotForm(createEmptySlotForm());
    },
    onError: error => toast.error(error.message),
  });

  const slotDeleteMutation = trpc.admin.deleteSlot.useMutation({
    onSuccess: async () => {
      toast.success("時段紀錄已刪除");
      setDeleteTarget(null);
      setSlotForm(createEmptySlotForm());
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const rescheduleMutation = trpc.admin.rescheduleBooking.useMutation({
    onSuccess: async () => {
      toast.success("預約已完成改期");
      try {
        await refreshAll();
        setRescheduleForm({ bookingId: "", currentSlotId: "", slotDate: "", customDate: "", newSlotId: "", customTimeRange: "", note: "", hasInspectionCompany: false });
      } finally {
        rescheduleSubmitLockedRef.current = false;
      }
    },
    onError: error => {
      rescheduleSubmitLockedRef.current = false;
      toast.error(error.message);
    },
  });

  const createBookingMutation = trpc.admin.createBooking.useMutation({
    onSuccess: async () => {
      toast.success("已完成代客預約，住戶將移出未完成名單");
      await refreshAll();
      setAssistedBookingForm({ residentId: "", linkId: "", slotDate: "", customDate: "", slotId: "", customTimeRange: "", note: "", gmail: "", hasInspectionCompany: false });
    },
    onError: error => toast.error(error.message),
  });

  const companyDeleteMutation = trpc.admin.deleteCompany.useMutation({
    onSuccess: async () => {
      toast.success("公司資料已刪除");
      setDeleteTarget(null);
      setCompanyForm(createEmptyCompanyForm());
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const projectDeleteMutation = trpc.admin.deleteProject.useMutation({
    onSuccess: async () => {
      toast.success("建案資料已刪除");
      setDeleteTarget(null);
      setProjectForm({ companyId: "", name: "", unitFormatHint: "", houseNumberExample: "", address: "" });
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const residentDeleteMutation = trpc.admin.deleteResident.useMutation({
    onSuccess: async () => {
      toast.success("住戶資料已刪除");
      setDeleteTarget(null);
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const linkDeleteMutation = trpc.admin.deleteLink.useMutation({
    onSuccess: async () => {
      toast.success("預約連結已刪除");
      setDeleteTarget(null);
      setLinkForm(createEmptyLinkForm());
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const toggleLinkEnabledMutation = trpc.admin.toggleLinkEnabled.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.isEnabled ? "預約連結已重新啟用" : "預約連結已停止");
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const projectOptions = useMemo(() => projects.map(project => ({ value: String(project.id), label: project.name })), [projects]);
  const residentProjectOptions = useMemo(() => getProjectsForCompany(projects, residentForm.companyId), [projects, residentForm.companyId]);
  const linkProjectOptions = useMemo(() => getProjectsForCompany(projects, linkForm.companyId), [projects, linkForm.companyId]);
  const slotProjectOptions = useMemo(() => getProjectsForCompany(projects, slotForm.companyId), [projects, slotForm.companyId]);
  const slotLinkOptions = useMemo(() => getLinksForProject(links, slotForm.projectId), [links, slotForm.projectId]);
  const bookingFilterLinkOptions = useMemo(() => getLinksForProject(links, bookingFilters.projectId), [links, bookingFilters.projectId]);
  const unbookedResidents = useMemo(
    () =>
      findUnbookedResidentsForProject({
        residents,
        bookings: dashboardBookings,
        projectId: bookingFilters.projectId,
        linkId: bookingFilters.linkId,
      }),
    [residents, dashboardBookings, bookingFilters.projectId, bookingFilters.linkId]
  );
  const projectNameById = useMemo(() => new Map(projects.map(project => [project.id, project.name])), [projects]);
  const filteredResidents = useMemo(() => filterResidentsByProject(residents, residentListProjectId), [residents, residentListProjectId]);
  const filteredSlots = useMemo(() => filterSlotsByLink(slots, selectedSlotLinkId || slotForm.linkId), [slots, selectedSlotLinkId, slotForm.linkId]);
  const bookingLinkUrlById = useMemo(() => buildBookingLinkUrlMap({ origin: window.location.origin, companies, projects, links }), [companies, projects, links]);
  const editingBooking = useMemo(() => bookings.find(booking => String(booking.id) === rescheduleForm.bookingId) ?? null, [bookings, rescheduleForm.bookingId]);
  const editingAssistedBookingResident = useMemo(
    () => unbookedResidents.find(resident => String(resident.id) === assistedBookingForm.residentId) ?? null,
    [unbookedResidents, assistedBookingForm.residentId]
  );
  const minCustomRescheduleDate = getTaipeiTodayDateKey();
  const effectiveRescheduleDate = rescheduleForm.slotDate === CUSTOM_DATE_OPTION_VALUE
    ? rescheduleForm.customDate
    : rescheduleForm.slotDate;
  const effectiveAssistedBookingDate = assistedBookingForm.slotDate === CUSTOM_DATE_OPTION_VALUE
    ? assistedBookingForm.customDate
    : assistedBookingForm.slotDate;
  const { syncOnDropdownOpen: syncRescheduleAvailability } = useRescheduleAvailabilitySync({
    resourceId: rescheduleForm.bookingId,
    slotDate: effectiveRescheduleDate,
    refetch: rescheduleAvailabilityQuery.refetch,
  });
  const { syncOnDropdownOpen: syncAssistedBookingAvailability } = useRescheduleAvailabilitySync({
    resourceId: assistedBookingForm.linkId,
    slotDate: effectiveAssistedBookingDate,
    refetch: bookingAvailabilityQuery.refetch,
  });
  const rescheduleAvailability = rescheduleAvailabilityQuery.data ?? [];
  const assistedBookingAvailability = bookingAvailabilityQuery.data ?? [];
  const rescheduleDateOptions = useMemo(() => {
    const seen = new Set<string>();
    return rescheduleAvailability.reduce<Array<{ value: string; label: string }>>((result, slot) => {
      const value = getDateKey(slot.slotDate);
      if (seen.has(value)) return result;
      seen.add(value);
      result.push({ value, label: formatDateOnly(slot.slotDate) });
      return result;
    }, []);
  }, [rescheduleAvailability]);
  const rescheduleSlotOptions = useMemo(() => {
    if (!effectiveRescheduleDate) return [] as typeof rescheduleAvailability;
    return rescheduleAvailability.filter(slot => getDateKey(slot.slotDate) === effectiveRescheduleDate);
  }, [effectiveRescheduleDate, rescheduleAvailability]);
  const assistedBookingDateOptions = useMemo(() => {
    const seen = new Set<string>();
    return assistedBookingAvailability.reduce<Array<{ value: string; label: string }>>((result, slot) => {
      const value = getDateKey(slot.slotDate);
      if (seen.has(value)) return result;
      seen.add(value);
      result.push({ value, label: formatDateOnly(slot.slotDate) });
      return result;
    }, []);
  }, [assistedBookingAvailability]);
  const assistedBookingSlotOptions = useMemo(() => {
    if (!effectiveAssistedBookingDate) return [] as typeof assistedBookingAvailability;
    return assistedBookingAvailability.filter(slot => getDateKey(slot.slotDate) === effectiveAssistedBookingDate);
  }, [assistedBookingAvailability, effectiveAssistedBookingDate]);
  const isDeleting = companyDeleteMutation.isPending || projectDeleteMutation.isPending || residentDeleteMutation.isPending || linkDeleteMutation.isPending || slotDeleteMutation.isPending;

  useEffect(() => {
    if (!bookingFilters.linkId) return;
    if (bookingFilterLinkOptions.some(link => String(link.id) === bookingFilters.linkId)) return;
    setBookingFilters(current => ({ ...current, linkId: "" }));
  }, [bookingFilterLinkOptions, bookingFilters.linkId]);

  useEffect(() => {
    if (!assistedBookingForm.residentId) return;
    if (bookingFilters.linkId && assistedBookingForm.linkId === bookingFilters.linkId) return;
    setAssistedBookingForm({ residentId: "", linkId: "", slotDate: "", customDate: "", slotId: "", customTimeRange: "", note: "", gmail: "", hasInspectionCompany: false });
  }, [bookingFilters.linkId, assistedBookingForm.residentId, assistedBookingForm.linkId]);

  const startEditingCompany = (company: typeof companies[number]) => {
    setCompanyForm(buildCompanyFormFromRecord(company));
  };

  const cancelEditingCompany = () => {
    setCompanyForm(createEmptyCompanyForm());
  };

  const updateEditableSlotPreset = (key: string, field: "startLabel" | "endLabel", value: string) => {
    setEditableSlotPresets(current => current.map(preset => (preset.key === key ? { ...preset, [field]: value } : preset)));
  };

  const resetEditableSlotPresets = () => {
    setEditableSlotPresets(createEditableSlotPresets());
  };

  const startEditingLink = (link: typeof links[number]) => {
    setLinkForm({
    id: link.id,
    companyId: String(link.companyId),
    projectId: String(link.projectId),
    type: link.type ?? "initial",
    isEnabled: link.isEnabled,
    startsAt: formatDateTimeInput(link.startsAt),
      endsAt: formatDateTimeInput(link.endsAt),
    });
  };

  const cancelEditingLink = () => {
    setLinkForm(createEmptyLinkForm());
  };

  const startEditingResident = (resident: typeof residents[number]) => {
    setResidentForm({
      id: resident.id,
      companyId: String(resident.companyId),
      projectId: String(resident.projectId),
      unitNumber: resident.unitNumber,
      phoneNumber: resident.phoneNumber,
      name: resident.name ?? "",
    });
    setResidentFormMode("edit");
    window.setTimeout(() => {
      document.getElementById("resident-management-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const startAddingResidentContact = (resident: typeof residents[number]) => {
    setResidentForm({
      id: undefined,
      companyId: String(resident.companyId),
      projectId: String(resident.projectId),
      unitNumber: resident.unitNumber,
      phoneNumber: "",
      name: "",
    });
    setResidentFormMode("add-contact");
    window.setTimeout(() => {
      document.getElementById("resident-management-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const cancelResidentForm = () => {
    setResidentForm(createEmptyResidentForm());
    setResidentFormMode("new");
  };

  const startEditingSlot = (slot: typeof slots[number]) => {
    setActiveTab("schedule");
    setSlotForm({
      id: String(slot.id),
      companyId: String(slot.companyId),
      projectId: String(slot.projectId),
      linkId: String(slot.linkId ?? ""),
      slotDate: getDateKey(slot.slotDate),
      rangeStartDate: "",
      rangeEndDate: "",
      dateMode: "single",
      startLabel: slot.startLabel,
      endLabel: slot.endLabel,
      capacity: String(slot.capacity),
      isActive: slot.isActive,
    });
    setSelectedSlotLinkId(String(slot.linkId ?? ""));
    toast.success("已帶入該時段資料，請直接在上方時段管理區編輯");
    window.setTimeout(() => {
      document.getElementById("slot-management-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const cancelEditingSlot = () => {
    setSlotForm(createEmptySlotForm());
  };

  const startEditingBooking = (booking: typeof bookings[number]) => {
    rescheduleSubmitLockedRef.current = false;
    const bookingDate = getDateKey(booking.slotDate);
    setRescheduleForm({
      bookingId: String(booking.id),
      currentSlotId: String(booking.slotId),
      slotDate: booking.slotIsPrivate ? CUSTOM_DATE_OPTION_VALUE : bookingDate,
      customDate: booking.slotIsPrivate ? bookingDate : "",
      newSlotId: "",
      customTimeRange: "",
      note: booking.internalNote || "",
      hasInspectionCompany: booking.hasInspectionCompany,
    });
  };

  const cancelEditingBooking = () => {
    rescheduleSubmitLockedRef.current = false;
    setRescheduleForm({ bookingId: "", currentSlotId: "", slotDate: "", customDate: "", newSlotId: "", customTimeRange: "", note: "", hasInspectionCompany: false });
  };

  const startAssistedBooking = (resident: typeof unbookedResidents[number]) => {
    if (!bookingFilters.linkId) {
      toast.error("請先選擇預約連結，再進行代客預約");
      return;
    }

    setAssistedBookingForm({
      residentId: String(resident.id),
      linkId: bookingFilters.linkId,
      slotDate: "",
      customDate: "",
      slotId: "",
      customTimeRange: "",
      note: "",
      gmail: "",
      hasInspectionCompany: false,
    });
  };

  const cancelAssistedBooking = () => {
    setAssistedBookingForm({ residentId: "", linkId: "", slotDate: "", customDate: "", slotId: "", customTimeRange: "", note: "", gmail: "", hasInspectionCompany: false });
  };

  useEffect(() => {
    if (!rescheduleForm.newSlotId || rescheduleForm.newSlotId === CUSTOM_SLOT_OPTION_VALUE) return;

    const selectedSlot = rescheduleSlotOptions.find(slot => String(slot.id) === rescheduleForm.newSlotId);
    if (selectedSlot && selectedSlot.remaining > 0) return;

    setRescheduleForm(current => ({ ...current, newSlotId: "" }));
  }, [rescheduleForm.newSlotId, rescheduleSlotOptions]);

  useEffect(() => {
    if (!assistedBookingForm.slotId || assistedBookingForm.slotId === CUSTOM_SLOT_OPTION_VALUE) return;

    const selectedSlot = assistedBookingSlotOptions.find(slot => String(slot.id) === assistedBookingForm.slotId);
    if (selectedSlot && selectedSlot.remaining > 0) return;

    setAssistedBookingForm(current => ({ ...current, slotId: "" }));
  }, [assistedBookingForm.slotId, assistedBookingSlotOptions]);

  const submitAssistedBooking = () => {
    if (!bookingFilters.linkId) {
      toast.error("請先選擇預約連結，再進行代客預約");
      return;
    }

    if (!assistedBookingForm.residentId || !editingAssistedBookingResident) {
      toast.error("請先選擇要代客預約的住戶");
      return;
    }

    if (!effectiveAssistedBookingDate || !assistedBookingForm.slotId) {
      toast.error("請選擇預約日期與時段");
      return;
    }

    if (assistedBookingForm.slotDate === CUSTOM_DATE_OPTION_VALUE && effectiveAssistedBookingDate < minCustomRescheduleDate) {
      toast.error("客製日期不可早於今天");
      return;
    }

    if (assistedBookingForm.slotId === CUSTOM_SLOT_OPTION_VALUE) {
      const validation = validateAdminCustomTimeRange(assistedBookingForm.customTimeRange);
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }

      createBookingMutation.mutate({
        linkId: Number(bookingFilters.linkId),
        residentId: Number(assistedBookingForm.residentId),
        customSlot: {
          slotDate: effectiveAssistedBookingDate,
          timeRange: validation.value,
        },
        note: assistedBookingForm.note || undefined,
        gmail: assistedBookingForm.gmail,
        hasInspectionCompany: assistedBookingForm.hasInspectionCompany,
      });
      return;
    }

    createBookingMutation.mutate({
      linkId: Number(bookingFilters.linkId),
      residentId: Number(assistedBookingForm.residentId),
      slotId: Number(assistedBookingForm.slotId),
      note: assistedBookingForm.note || undefined,
      gmail: assistedBookingForm.gmail,
      hasInspectionCompany: assistedBookingForm.hasInspectionCompany,
    });
  };

  const saveResident = () => {
    const validationMessage = validateResidentForm(residentForm, projects);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    residentMutation.mutate({
      ...residentForm,
      companyId: parsePositiveId(residentForm.companyId) as number,
      projectId: parsePositiveId(residentForm.projectId) as number,
    });
  };

  const saveLink = () => {
    const validation = validateBookingLinkForm(linkForm);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    linkMutation.mutate(validation.payload);
  };

  const copyBookingLink = async (url: string | null) => {
    if (!url) {
      toast.error("這筆連結缺少分享 token 或關聯資料，暫時無法產生網址");
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success("預約連結已複製，可直接傳給客戶");
    } catch {
      toast.error("瀏覽器無法直接複製，請手動複製畫面上的網址");
    }
  };

  const createPresetSlots = async () => {
    const validation = buildPresetSlotPayloads(
      {
        linkId: slotForm.linkId,
        slotDate: slotForm.slotDate,
        rangeStartDate: slotForm.rangeStartDate,
        rangeEndDate: slotForm.rangeEndDate,
        dateMode: slotForm.dateMode,
        capacity: slotForm.capacity,
        isActive: slotForm.isActive,
      },
      editableSlotPresets
    );

    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    const filteredLinkSlots = filterSlotsByLink(slots, slotForm.linkId);
    const duplicatePayload = validation.payloads.find(payload =>
      filteredLinkSlots.some(slot => {
        const slotDate = getDateKey(slot.slotDate);
        const payloadDate = getDateKey(payload.slotDate);
        return slotDate === payloadDate && slot.startLabel === payload.startLabel && slot.endLabel === payload.endLabel;
      })
    );

    if (duplicatePayload) {
      const duplicateDate = getDateKey(duplicatePayload.slotDate);
      toast.error(`此預約連結在 ${duplicateDate} 的 ${duplicatePayload.startLabel}-${duplicatePayload.endLabel} 已存在，請先調整後再建立`);
      return;
    }

    try {
      for (const payload of validation.payloads) {
        await slotMutation.mutateAsync(payload);
      }
      resetEditableSlotPresets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "建立預設時段失敗");
    }
  };

  const saveSlot = () => {
    if (slotForm.dateMode === "range" && !slotForm.id) {
      toast.error("日期區間模式只支援一鍵建立預設時段；若要單筆建立，請切回單一日期")
      return;
    }

    const validation = validateSingleSlotForm(slotForm);
    if (!validation.ok) {
      toast.error(validation.message);
      return;
    }

    slotMutation.mutate(validation.payload);
  };

  const submitReschedule = () => {
    if (rescheduleSubmitLockedRef.current) return;
    if (!rescheduleForm.bookingId) {
      toast.error("請先選擇要改期的預約紀錄");
      return;
    }
    if (!effectiveRescheduleDate) {
      toast.error("請先選擇新的預約日期");
      return;
    }

    if (rescheduleForm.slotDate === CUSTOM_DATE_OPTION_VALUE && effectiveRescheduleDate < minCustomRescheduleDate) {
      toast.error("客製日期不可早於今天");
      return;
    }

    if (!rescheduleForm.newSlotId) {
      toast.error("請先選擇新的預約時段");
      return;
    }

    if (rescheduleForm.newSlotId === CUSTOM_SLOT_OPTION_VALUE) {
      const validation = validateAdminCustomTimeRange(rescheduleForm.customTimeRange);
      if (!validation.ok) {
        toast.error(validation.message);
        return;
      }

      rescheduleSubmitLockedRef.current = true;
      rescheduleMutation.mutate({
        bookingId: Number(rescheduleForm.bookingId),
        currentSlotId: rescheduleForm.currentSlotId ? Number(rescheduleForm.currentSlotId) : undefined,
        customSlot: {
          slotDate: effectiveRescheduleDate,
          timeRange: validation.value,
        },
        note: rescheduleForm.note || undefined,
        hasInspectionCompany: rescheduleForm.hasInspectionCompany,
      });
      return;
    }

    rescheduleSubmitLockedRef.current = true;
    rescheduleMutation.mutate({
      bookingId: Number(rescheduleForm.bookingId),
      currentSlotId: rescheduleForm.currentSlotId ? Number(rescheduleForm.currentSlotId) : undefined,
      newSlotId: Number(rescheduleForm.newSlotId),
      note: rescheduleForm.note || undefined,
      hasInspectionCompany: rescheduleForm.hasInspectionCompany,
    });
  };

  const downloadBookingList = async () => {
    if (!bookings.length) {
      toast.error("目前篩選條件下沒有可下載的預約紀錄");
      return;
    }

    try {
      setIsDownloadingBookingList(true);
      await downloadBookingListWorkbook(bookings);
      toast.success("預約清單已開始下載");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "下載預約清單失敗");
    } finally {
      setIsDownloadingBookingList(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.step === 1) {
      setDeleteTarget(current => (current ? { ...current, step: 2 } : current));
      return;
    }

    if (deleteTarget.type === "company") {
      await companyDeleteMutation.mutateAsync({ id: deleteTarget.id });
      return;
    }

    if (deleteTarget.type === "project") {
      await projectDeleteMutation.mutateAsync({ id: deleteTarget.id });
      return;
    }

    if (deleteTarget.type === "link") {
      await linkDeleteMutation.mutateAsync({ id: deleteTarget.id });
      return;
    }

    if (deleteTarget.type === "slot") {
      await slotDeleteMutation.mutateAsync({ id: deleteTarget.id });
      return;
    }

    await residentDeleteMutation.mutateAsync({ id: deleteTarget.id });
  };

  if (adminProfile.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />後台載入中...</div>
      </div>
    );
  }

  if (!adminProfile.data) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#102733_0%,#294550_55%,#8d6c53_100%)] p-6 text-white">
        <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="space-y-6">
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">管理後台</Badge>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">驗屋預約管理系統後台</h1>
            <p className="max-w-2xl text-base leading-8 text-white/80">
              這個後台的重點不是炫技，而是把多公司、多建案、住戶驗證、時段設定、連結控管、改期歷程全部收斂到同一個管理入口。你如果把這些資料拆散在表單或 Excel，後面只會更亂。
            </p>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <Building2 className="h-5 w-5" />
                <p className="mt-4 font-medium">品牌與建案</p>
                <p className="mt-2 text-sm text-white/72">統一管理公司內容、建案資料與戶號格式提示。</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <CalendarRange className="h-5 w-5" />
                <p className="mt-4 font-medium">時段與連結</p>
                <p className="mt-2 text-sm text-white/72">初驗／複驗連結與預約時段分開控管，避免舊連結誤用。</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-sm">
                <ArrowRightLeft className="h-5 w-5" />
                <p className="mt-4 font-medium">改期歷程</p>
                <p className="mt-2 text-sm text-white/72">後台直接改期，同時保留原時段與備註歷史。</p>
              </div>
            </div>
          </div>
              <Card className="border-white/10 bg-white/92 text-card-foreground shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><LockKeyhole className="h-5 w-5" /> 管理員登入</CardTitle>
                  <CardDescription>目前系統採單一管理員帳密。正式站不應長期使用預設帳密，後續必須改成你的正式憑證。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="admin-username">帳號</Label>
                    <Input id="admin-username" value={credentials.username} onChange={event => setCredentials(current => ({ ...current, username: event.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">密碼</Label>
                    <Input id="admin-password" type="password" value={credentials.password} onChange={event => setCredentials(current => ({ ...current, password: event.target.value }))} />
                  </div>
                  <Button className="w-full" onClick={() => loginMutation.mutate(credentials)} disabled={loginMutation.isPending}>
                    {loginMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    登入後台
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <a href="/">
                      <ArrowLeft className="h-4 w-4" />
                      返回首頁
                    </a>
                  </Button>
                  <p className="text-xs leading-6 text-muted-foreground">請輸入你設定在正式環境中的單一管理員帳密。系統不會在畫面上展示任何預設憑證。</p>
                </CardContent>
              </Card>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ec] text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <div>
            <p className="text-sm text-muted-foreground">管理員登入中</p>
            <h1 className="text-2xl font-semibold tracking-tight">驗屋預約管理系統後台</h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">{adminProfile.data.username}</Badge>
            <Button variant="outline" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>登出</Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <div className="grid gap-6 lg:grid-cols-4">
          <Card className="lg:col-span-1 shadow-sm">
            <CardHeader>
              <CardTitle>系統摘要</CardTitle>
              <CardDescription>你有沒有想過，正式站最容易出事的不是畫面，而是資料沒被統一管理。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-muted/40 p-4"><p>公司數量</p><p className="mt-2 text-2xl font-semibold text-foreground">{companies.length}</p></div>
              <div className="rounded-2xl bg-muted/40 p-4"><p>建案數量</p><p className="mt-2 text-2xl font-semibold text-foreground">{projects.length}</p></div>
              <div className="rounded-2xl bg-muted/40 p-4"><p>住戶筆數</p><p className="mt-2 text-2xl font-semibold text-foreground">{residents.length}</p></div>
              <div className="rounded-2xl bg-muted/40 p-4"><p>預約筆數</p><p className="mt-2 text-2xl font-semibold text-foreground">{dashboardQuery.data?.bookings.length ?? 0}</p></div>
            </CardContent>
          </Card>

          <div className="lg:col-span-3">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full grid-cols-6">
                <TabsTrigger value="companies">公司</TabsTrigger>
                <TabsTrigger value="projects">建案</TabsTrigger>
                <TabsTrigger value="residents">住戶</TabsTrigger>
                <TabsTrigger value="schedule">連結與時段</TabsTrigger>
                <TabsTrigger value="statistics">統計數量</TabsTrigger>
                <TabsTrigger value="bookings">預約與改期</TabsTrigger>
              </TabsList>

              <TabsContent value="companies" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>公司管理</CardTitle>
                    <CardDescription>流程、FAQ、注意事項全部掛在公司層級。這樣做的好處是新建案可直接繼承；風險是內容更新會影響同公司所有建案，所以你要有版本意識。</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司代號 slug</Label><Input value={companyForm.slug} onChange={event => setCompanyForm(current => ({ ...current, slug: event.target.value }))} placeholder="例如 yisin" disabled={Boolean(companyForm.id)} /></div>
                    <div className="space-y-2"><Label>公司名稱</Label><Input value={companyForm.name} onChange={event => setCompanyForm(current => ({ ...current, name: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>Logo URL</Label><Input value={companyForm.logoUrl} onChange={event => setCompanyForm(current => ({ ...current, logoUrl: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>聯絡電話</Label><Input value={companyForm.contactPhone} onChange={event => setCompanyForm(current => ({ ...current, contactPhone: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>主標題</Label><Input value={companyForm.heroTitle} onChange={event => setCompanyForm(current => ({ ...current, heroTitle: event.target.value }))} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>主視覺說明</Label><Textarea value={companyForm.heroDescription} onChange={event => setCompanyForm(current => ({ ...current, heroDescription: event.target.value }))} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>驗屋流程</Label><Textarea value={companyForm.inspectionFlow} onChange={event => setCompanyForm(current => ({ ...current, inspectionFlow: event.target.value }))} className="min-h-28" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>交屋流程</Label><Textarea value={companyForm.handoverFlow} onChange={event => setCompanyForm(current => ({ ...current, handoverFlow: event.target.value }))} className="min-h-24" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>注意事項</Label><Textarea value={companyForm.precautions} onChange={event => setCompanyForm(current => ({ ...current, precautions: event.target.value }))} className="min-h-24" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>FAQ（每行格式：問題 | 回答）</Label><Textarea value={companyForm.faqText} onChange={event => setCompanyForm(current => ({ ...current, faqText: event.target.value }))} className="min-h-28" /></div>
                    <div className="space-y-2 md:col-span-2"><Label>聯絡窗口說明</Label><Textarea value={companyForm.contactWindow} onChange={event => setCompanyForm(current => ({ ...current, contactWindow: event.target.value }))} className="min-h-24" /></div>
                    <div className="md:col-span-2 flex flex-wrap gap-3"><Button onClick={() => companyMutation.mutate({ ...companyForm, id: companyForm.id ? Number(companyForm.id) : undefined, faqItems: parseFaq(companyForm.faqText) })} disabled={companyMutation.isPending}>{companyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{companyForm.id ? "更新公司資料" : "儲存公司資料"}</Button>{companyForm.id ? <Button variant="outline" onClick={cancelEditingCompany} disabled={companyMutation.isPending}>取消編輯</Button> : null}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>既有公司</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>公司</TableHead><TableHead>聯絡方式</TableHead><TableHead>最後更新</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {companies.map(company => (
                          <TableRow key={company.id}>
                            <TableCell>{company.name}</TableCell>
                            <TableCell>{company.contactPhone}</TableCell>
                            <TableCell>{formatDateTime(company.updatedAt)}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => startEditingCompany(company)}>編輯</Button>
                                <Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "company", id: company.id, label: company.name, step: 1 })}>刪除</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="projects" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>建案管理</CardTitle><CardDescription>每個建案只維護差異資料，例如名稱、戶號格式提示與地址。這樣做的風險是：如果你想讓個別建案覆寫 FAQ，現在這版還沒做。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>所屬公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={projectForm.companyId} onChange={event => setProjectForm(current => ({ ...current, companyId: event.target.value }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案名稱</Label><Input value={projectForm.name} onChange={event => setProjectForm(current => ({ ...current, name: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>地址</Label><Input value={projectForm.address} onChange={event => setProjectForm(current => ({ ...current, address: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>戶號格式提示</Label><Input value={projectForm.unitFormatHint} onChange={event => setProjectForm(current => ({ ...current, unitFormatHint: event.target.value }))} placeholder="例如 棟別-樓層-戶別" /></div>
                    <div className="space-y-2"><Label>戶號範例</Label><Input value={projectForm.houseNumberExample} onChange={event => setProjectForm(current => ({ ...current, houseNumberExample: event.target.value }))} placeholder="例如 A-4-A" /></div>
                    <div className="md:col-span-2"><Button onClick={() => projectMutation.mutate({ ...projectForm, slug: createProjectSlug(projectForm.name, projectForm.companyId), companyId: Number(projectForm.companyId) })} disabled={projectMutation.isPending}>{projectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}儲存建案資料</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>既有建案</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>建案</TableHead><TableHead>公司 ID</TableHead><TableHead>戶號範例</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {projects.map(project => (
                          <TableRow key={project.id}>
                            <TableCell>{project.name}</TableCell>
                            <TableCell>{project.companyId}</TableCell>
                            <TableCell>{project.houseNumberExample}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "project", id: project.id, label: project.name, step: 1 })}>刪除</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="residents" className="space-y-6">
                <Card id="resident-management-card">
                  <CardHeader><CardTitle>{residentFormMode === "edit" ? "編輯住戶聯絡資料" : residentFormMode === "add-contact" ? "新增該戶資料" : "住戶資料管理"}</CardTitle><CardDescription>同一建案、同一戶號可有多筆聯絡資料。預約與統計均以戶號計算；任一筆有填手機的資料都可用於住戶驗證。手機與姓名至少需填寫一項。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={residentForm.companyId} onChange={event => setResidentForm(current => ({ ...current, companyId: event.target.value, projectId: "" }))} disabled={residentFormMode !== "new"}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={residentForm.projectId} onChange={event => setResidentForm(current => ({ ...current, projectId: event.target.value }))} disabled={!residentForm.companyId || residentFormMode !== "new"}><option value="">{residentForm.companyId ? "請選擇" : "請先選公司"}</option>{residentProjectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>標準戶號</Label><Input value={residentForm.unitNumber} onChange={event => setResidentForm(current => ({ ...current, unitNumber: event.target.value }))} disabled={residentFormMode !== "new"} /></div>
                    <div className="space-y-2"><Label>手機號碼</Label><Input value={residentForm.phoneNumber} onChange={event => setResidentForm(current => ({ ...current, phoneNumber: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>姓名</Label><Input value={residentForm.name} onChange={event => setResidentForm(current => ({ ...current, name: event.target.value }))} /></div>
                    <div className="md:col-span-2 space-y-2"><div className="flex flex-wrap gap-3"><Button onClick={saveResident} disabled={residentMutation.isPending}>{residentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{residentFormMode === "edit" ? "更新聯絡資料" : residentFormMode === "add-contact" ? "儲存新增資料" : "儲存住戶資料"}</Button>{residentFormMode !== "new" ? <Button variant="outline" onClick={cancelResidentForm} disabled={residentMutation.isPending}>取消</Button> : null}</div><p className="text-sm text-muted-foreground">若同一戶別有多位聯絡人，請從該戶其中一筆資料的「編輯」進入，再點選「新增該戶資料」。沒有手機的資料會保留姓名，但不可用於住戶驗證。</p></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>住戶清單</CardTitle>
                    <CardDescription>這裡已改成可依建案篩選。這樣做的風險是如果你不先選建案，案量一大時仍然會難找，因此預設保留全部，但提供立即縮小清單的入口。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-[minmax(0,260px)_1fr] md:items-end">
                      <div className="space-y-2">
                        <Label>依建案篩選</Label>
                        <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={residentListProjectId} onChange={event => setResidentListProjectId(event.target.value)}>
                          <option value="">全部建案</option>
                          {projectOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </div>
                      <p className="text-sm text-muted-foreground">目前顯示 {filteredResidents.length} 筆住戶資料。</p>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>建案</TableHead><TableHead>戶號</TableHead><TableHead>手機</TableHead><TableHead>姓名</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                        <TableBody>{filteredResidents.length ? filteredResidents.map(resident => <TableRow key={resident.id}><TableCell>{projectNameById.get(resident.projectId) || `建案 ${resident.projectId}`}</TableCell><TableCell>{resident.unitNumber}</TableCell><TableCell>{resident.phoneNumber || "-"}</TableCell><TableCell>{resident.name || "-"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => startEditingResident(resident)}>編輯</Button><Button variant="outline" size="sm" onClick={() => startAddingResidentContact(resident)}>新增該戶資料</Button><Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "resident", id: resident.id, label: `${resident.unitNumber}${resident.name ? `／${resident.name}` : ""}`, step: 1 })}>刪除</Button></div></TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">目前篩選條件下沒有住戶資料。</TableCell></TableRow>}</TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>預約連結管理</CardTitle><CardDescription>停止連結與刪除連結是兩件不同的事；另外現在同一建案可建立多筆連結。也就是說，你每按一次確認，都會產生一筆可獨立分享、可獨立停止的連結。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.companyId} onChange={event => setLinkForm(current => ({ ...current, companyId: event.target.value, projectId: "" }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.projectId} onChange={event => setLinkForm(current => ({ ...current, projectId: event.target.value }))} disabled={!linkForm.companyId}><option value="">{linkForm.companyId ? "請選擇" : "請先選公司"}</option>{linkProjectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>類型</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.type} onChange={event => setLinkForm(current => ({ ...current, type: event.target.value }))}><option value="initial">初驗</option><option value="reinspect">複驗</option></select></div>
                    <div className="space-y-2"><Label>開始時間</Label><Input type="datetime-local" value={linkForm.startsAt} onChange={event => setLinkForm(current => ({ ...current, startsAt: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>結束時間</Label><Input type="datetime-local" value={linkForm.endsAt} onChange={event => setLinkForm(current => ({ ...current, endsAt: event.target.value }))} /></div>
                    <div className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={linkForm.isEnabled} onChange={event => setLinkForm(current => ({ ...current, isEnabled: event.target.checked }))} /><span className="text-sm text-muted-foreground">目前啟用</span></div>
                    <div className="md:col-span-2 space-y-2"><div className="flex flex-wrap gap-3"><Button onClick={saveLink} disabled={linkMutation.isPending}>{linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{linkForm.id ? "更新連結設定" : "確認並產生預約連結"}</Button>{linkForm.id ? <Button variant="outline" onClick={cancelEditingLink} disabled={linkMutation.isPending}>取消編輯</Button> : null}</div><p className="text-sm text-muted-foreground">送出後系統會建立一筆獨立分享連結，請到下方「目前連結與時段」直接複製網址傳給客戶。</p></div>
                  </CardContent>
                </Card>

                <Card id="slot-management-card">
                  <CardHeader><CardTitle>時段管理</CardTitle><CardDescription>這裡的原則很單純：時段必須掛在明確的預約連結下，不能再用共用池混著放，不然後面只會把舊時段誤帶到新連結。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.companyId} onChange={event => setSlotForm(current => ({ ...current, id: "", companyId: event.target.value, projectId: "", linkId: "" }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.projectId} onChange={event => setSlotForm(current => ({ ...current, id: "", projectId: event.target.value, linkId: "" }))} disabled={!slotForm.companyId}><option value="">{slotForm.companyId ? "請選擇" : "請先選公司"}</option>{slotProjectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>預約連結</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.linkId} onChange={event => { const nextLinkId = event.target.value; setSlotForm(current => ({ ...current, id: current.id, linkId: nextLinkId })); setSelectedSlotLinkId(nextLinkId); }} disabled={!slotForm.projectId}><option value="">{slotForm.projectId ? "請選擇" : "請先選建案"}</option>{slotLinkOptions.map(link => <option key={link.id} value={link.id}>{`${link.type} / #${link.id}${link.isEnabled ? "" : "（已停用）"}`}</option>)}</select></div>
                    <div className="md:col-span-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <Label>時段建立模式</Label>
                      <Tabs
                        value={slotForm.dateMode}
                        onValueChange={nextMode => setSlotForm(current => ({ ...current, id: current.id ? current.id : "", dateMode: nextMode as "single" | "range", slotDate: "", rangeStartDate: "", rangeEndDate: "" }))}
                        className="mt-3 space-y-4"
                      >
                        <TabsList className="grid w-full h-auto grid-cols-1 gap-2 md:grid-cols-2">
                          <TabsTrigger value="single" disabled={Boolean(slotForm.id)} className="whitespace-normal px-4 py-3 text-sm">單一日期選擇</TabsTrigger>
                          <TabsTrigger value="range" disabled={Boolean(slotForm.id)} className="whitespace-normal px-4 py-3 text-sm">驗屋預約連接開放時間：日期區間</TabsTrigger>
                        </TabsList>
                        <TabsContent value="single" className="mt-0">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2"><Label>日期</Label><Input type="date" value={slotForm.slotDate} onChange={event => setSlotForm(current => ({ ...current, slotDate: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>名額</Label><Input type="number" min="1" value={slotForm.capacity} onChange={event => setSlotForm(current => ({ ...current, capacity: event.target.value }))} /></div>
                          </div>
                        </TabsContent>
                        <TabsContent value="range" className="mt-0">
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2"><Label>區間開始</Label><Input type="date" value={slotForm.rangeStartDate} onChange={event => setSlotForm(current => ({ ...current, rangeStartDate: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>區間結束</Label><Input type="date" value={slotForm.rangeEndDate} onChange={event => setSlotForm(current => ({ ...current, rangeEndDate: event.target.value }))} /></div>
                            <div className="space-y-2"><Label>名額</Label><Input type="number" min="1" value={slotForm.capacity} onChange={event => setSlotForm(current => ({ ...current, capacity: event.target.value }))} /></div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                    <div className="space-y-2"><Label>開始</Label><Input value={slotForm.startLabel} onChange={event => setSlotForm(current => ({ ...current, startLabel: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>結束</Label><Input value={slotForm.endLabel} onChange={event => setSlotForm(current => ({ ...current, endLabel: event.target.value }))} /></div>
                    <div className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={slotForm.isActive} onChange={event => setSlotForm(current => ({ ...current, isActive: event.target.checked }))} /><span className="text-sm text-muted-foreground">啟用時段</span></div>
                    <div className="md:col-span-2 flex flex-wrap gap-3"><Button onClick={saveSlot} disabled={slotMutation.isPending}>{slotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{slotForm.id ? "更新時段" : "儲存時段"}</Button>{slotForm.id ? <Button variant="outline" onClick={cancelEditingSlot} disabled={slotMutation.isPending}>取消編輯</Button> : null}</div>
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-sm font-medium">快速建立常用時段</p>
                          <p className="mt-2 text-sm text-muted-foreground">不需要四筆全填，只要有填的時段就會建立，空白的會自動跳過。日期區間模式會把同一組時段套用到區間內每一天，所以區間起訖一定要先看清楚。</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={resetEditableSlotPresets}>重設本次預設</Button>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        {editableSlotPresets.map((preset, index) => (
                          <div key={preset.key} className="rounded-xl border border-border/70 bg-background p-4">
                            <p className="text-sm font-medium">預設時段 {index + 1}</p>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="space-y-2"><Label>開始</Label><Input value={preset.startLabel} onChange={event => updateEditableSlotPreset(preset.key, "startLabel", event.target.value)} /></div>
                              <div className="space-y-2"><Label>結束</Label><Input value={preset.endLabel} onChange={event => updateEditableSlotPreset(preset.key, "endLabel", event.target.value)} /></div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2">
                        {slotForm.dateMode === "range" && !slotForm.id ? <p className="text-sm text-muted-foreground">你現在使用的是日期區間模式。選好開始與結束日期後，直接按下方按鈕，系統會對區間內每一天建立同一組預設時段。</p> : null}
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" size="sm" onClick={createPresetSlots} disabled={slotMutation.isPending}>一鍵建立預設時段</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>目前連結與時段</CardTitle><CardDescription>你已經建立連結卻拿不到網址，這就是交付斷點。現在每筆已啟用或已停止的連結都會直接顯示可分享網址，方便你複製給客戶。</CardDescription></CardHeader>
                  <CardContent className="grid gap-6 xl:grid-cols-2">
                    <div className="xl:col-span-2 rounded-2xl border border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-medium">依預約連結篩選時段</p>
                      <p className="mt-2 text-sm text-muted-foreground">舊共用時段已被後台隱藏；你現在看到的清單應該只跟指定連結有關。若這裡還混到別的連結，方向就錯了。</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {inspectionLinks.map(link => (
                          <Button key={link.id} type="button" variant={(selectedSlotLinkId || slotForm.linkId) === String(link.id) ? "default" : "outline"} size="sm" onClick={() => setSelectedSlotLinkId(String(link.id))}>{`${projectNameById.get(link.projectId) || `建案 ${link.projectId}`} / ${link.type} / #${link.id}`}</Button>
                        ))}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>建案</TableHead><TableHead>類型</TableHead><TableHead>狀態</TableHead><TableHead>分享網址</TableHead><TableHead>啟用期間</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{inspectionLinks.map(link => { const bookingUrl = bookingLinkUrlById.get(link.id) ?? null; return <TableRow key={link.id}><TableCell>{projectNameById.get(link.projectId) || `建案 ${link.projectId}`}</TableCell><TableCell>{link.type} / #{link.id}</TableCell><TableCell><Badge variant={link.isEnabled ? "outline" : "secondary"}>{link.isEnabled ? "啟用中" : "已停止"}</Badge></TableCell><TableCell className="min-w-[260px]"><div className="space-y-2"><p className="break-all text-xs text-muted-foreground">{bookingUrl || "缺少 share token，暫時無法產生連結"}</p>{bookingUrl ? <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => copyBookingLink(bookingUrl)}><Copy className="h-4 w-4" />複製</Button><Button asChild variant="outline" size="sm"><a href={bookingUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />開啟</a></Button></div> : null}</div></TableCell><TableCell>{formatDateTime(link.startsAt)} ~ {formatDateTime(link.endsAt)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => startEditingLink(link)}>編輯</Button><Button variant="outline" size="sm" onClick={() => toggleLinkEnabledMutation.mutate({ id: link.id, isEnabled: !link.isEnabled, disabledReason: link.disabledReason || "此連結已由後台停止" })} disabled={toggleLinkEnabledMutation.isPending}>{link.isEnabled ? "停止" : "重新啟用"}</Button><Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "link", id: link.id, label: `${projectNameById.get(link.projectId) || `建案 ${link.projectId}`} / ${link.type} / #${link.id}`, step: 1 })}>刪除</Button></div></TableCell></TableRow>; })}</TableBody></Table>
                    </div>
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>連結 ID</TableHead><TableHead>日期</TableHead><TableHead>時段</TableHead><TableHead>名額</TableHead><TableHead>狀態</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader><TableBody>{filteredSlots.map(slot => <TableRow key={slot.id}><TableCell>{slot.linkId ?? "-"}</TableCell><TableCell>{formatDateOnly(slot.slotDate)}</TableCell><TableCell>{slot.startLabel} - {slot.endLabel}</TableCell><TableCell>{slot.capacity}</TableCell><TableCell>{slot.isActive ? "啟用" : "停用"}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => startEditingSlot(slot)}>編輯</Button><Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "slot", id: slot.id, label: `${formatDateOnly(slot.slotDate)} ${slot.startLabel}-${slot.endLabel}`, step: 1 })}>刪除</Button></div></TableCell></TableRow>)}</TableBody></Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="statistics" className="space-y-6">
                <AdminStatisticsPanel companies={companies} projects={projects} links={links} onRefresh={refreshAll} />
              </TabsContent>

              <TabsContent value="bookings" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>預約紀錄查詢</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-6">
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.projectId} onChange={event => setBookingFilters(current => ({ ...current, projectId: event.target.value, linkId: "" }))}><option value="">全部</option>{projectOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                    <div className="space-y-2"><Label>該建案對應連結</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.linkId} onChange={event => setBookingFilters(current => ({ ...current, linkId: event.target.value }))} disabled={!bookingFilters.projectId}><option value="">{bookingFilters.projectId ? "全部連結" : "請先選建案"}</option>{bookingFilterLinkOptions.map(link => <option key={link.id} value={link.id}>{`${link.type} / #${link.id}${link.isEnabled ? "" : "（已停用）"}`}</option>)}</select></div>
                    <div className="space-y-2"><Label>戶號</Label><Input value={bookingFilters.unitNumber} onChange={event => setBookingFilters(current => ({ ...current, unitNumber: event.target.value }))} placeholder="可模糊查詢" /></div>
                    <div className="space-y-2"><Label>類型</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.bookingType} onChange={event => setBookingFilters(current => ({ ...current, bookingType: event.target.value }))}><option value="all">全部</option><option value="initial">初驗</option><option value="reinspect">複驗</option></select></div>
                    <div className="space-y-2"><Label>狀態</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.status} onChange={event => setBookingFilters(current => ({ ...current, status: event.target.value }))}><option value="all">全部</option><option value="booked">booked</option><option value="rescheduled">rescheduled</option><option value="cancelled">cancelled</option></select></div>
                    <div className="space-y-2"><Label>預約日期</Label><Input type="date" value={bookingFilters.bookingDate} onChange={event => setBookingFilters(current => ({ ...current, bookingDate: event.target.value }))} /></div>
                  </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                      <CardTitle>未完成預約住戶</CardTitle>
                      <CardDescription>這個清單現在不是看整個建案，而是看你上方選定的建案與對應預約連結。只有在該 link 下尚未完成預約的戶別才會出現；後台代客預約則可比照預約紀錄編輯改期，不受連結開放時間限制。</CardDescription>
                    </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!bookingFilters.projectId || !bookingFilters.linkId}
                        onClick={() => {
                          if (!bookingFilters.projectId || !bookingFilters.linkId) {
                            toast.error("請先選擇建案與對應預約連結，再查看未完成預約住戶");
                            return;
                          }
                          setShowUnbookedResidents(current => !current);
                        }}
                      >
                        {showUnbookedResidents ? "隱藏未完成預約住戶" : "查看未完成預約住戶"}
                      </Button>
                      {bookingFilters.projectId && bookingFilters.linkId ? <Badge variant="secondary">{unbookedResidents.length} 戶未完成</Badge> : null}
                    </div>
                    {showUnbookedResidents && bookingFilters.projectId && bookingFilters.linkId ? (
                      unbookedResidents.length ? (
                        <div className="overflow-x-auto rounded-2xl border border-border/70">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>建案</TableHead>
                                <TableHead>戶號</TableHead>
                                <TableHead>手機</TableHead>
                                <TableHead>姓名</TableHead>
                                <TableHead className="text-right">操作</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {unbookedResidents.map(resident => (
                                <React.Fragment key={resident.id}>
                                  <TableRow>
                                    <TableCell>{projectNameById.get(resident.projectId) || `建案 ${resident.projectId}`}</TableCell>
                                    <TableCell>{resident.unitNumber}</TableCell>
                                    <TableCell>{resident.phoneNumber || "-"}</TableCell>
                                    <TableCell>{resident.name || "-"}</TableCell>
                                    <TableCell className="text-right">
                                      <Button variant="outline" size="sm" onClick={() => startAssistedBooking(resident)}>
                                        {assistedBookingForm.residentId === String(resident.id) ? "代客預約中" : "代客預約"}
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                  {assistedBookingForm.residentId === String(resident.id) ? (
                                    <TableRow>
                                      <TableCell colSpan={5} className="bg-muted/20">
                                        <AdminAssistedBookingFields
                                          slotDate={assistedBookingForm.slotDate}
                                          customDate={assistedBookingForm.customDate}
                                          slotId={assistedBookingForm.slotId}
                                          customTimeRange={assistedBookingForm.customTimeRange}
                                          minCustomDate={minCustomRescheduleDate}
                                          note={assistedBookingForm.note}
                                          gmail={assistedBookingForm.gmail}
                                          hasInspectionCompany={assistedBookingForm.hasInspectionCompany}
                                          dateOptions={assistedBookingDateOptions}
                                          slotOptions={assistedBookingSlotOptions}
                                          isFetching={bookingAvailabilityQuery.isFetching}
                                          errorMessage={bookingAvailabilityQuery.error?.message}
                                          isSubmitting={createBookingMutation.isPending}
                                          onChangeDate={slotDate => setAssistedBookingForm(current => ({ ...current, slotDate, customDate: "", slotId: "", customTimeRange: "" }))}
                                          onChangeCustomDate={customDate => setAssistedBookingForm(current => ({ ...current, customDate, slotId: "", customTimeRange: "" }))}
                                          onChangeSlot={slotId => setAssistedBookingForm(current => ({ ...current, slotId, customTimeRange: slotId === CUSTOM_SLOT_OPTION_VALUE ? current.customTimeRange : "" }))}
                                          onChangeCustomTimeRange={customTimeRange => setAssistedBookingForm(current => ({ ...current, customTimeRange }))}
                                          onChangeNote={note => setAssistedBookingForm(current => ({ ...current, note }))}
                                          onChangeGmail={gmail => setAssistedBookingForm(current => ({ ...current, gmail }))}
                                          onChangeHasInspectionCompany={hasInspectionCompany =>
                                            setAssistedBookingForm(current => ({ ...current, hasInspectionCompany }))
                                          }
                                          onSyncAvailability={syncAssistedBookingAvailability}
                                          onSubmit={submitAssistedBooking}
                                          onCancel={cancelAssistedBooking}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ) : null}
                                </React.Fragment>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">目前所選建案與預約連結下的住戶都已有未取消的預約紀錄。</div>
                      )
                    ) : null}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>改期操作</CardTitle><CardDescription>你現在不用再手動輸入預約 ID 與時段 ID。請直接在下方預約紀錄點選「編輯改期」，再選新的日期與時段。</CardDescription></CardHeader>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle>預約紀錄</CardTitle>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={downloadBookingList} disabled={isDownloadingBookingList || !bookings.length}>
                      {isDownloadingBookingList ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                      下載預約清單
                    </Button>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                      <AdminBookingRecordsTable
                      bookings={bookings}
                      editingBookingId={rescheduleForm.bookingId}
                      rescheduleForm={rescheduleForm}
                      minCustomDate={minCustomRescheduleDate}
                      dateOptions={rescheduleDateOptions}
                      slotOptions={rescheduleSlotOptions}
                      isFetching={rescheduleAvailabilityQuery.isFetching}
                      errorMessage={rescheduleAvailabilityQuery.error?.message}
                      isSubmitting={rescheduleMutation.isPending}
                      onStartEditing={startEditingBooking}
                      onChangeDate={nextDate => setRescheduleForm(current => ({ ...current, slotDate: nextDate, customDate: "", newSlotId: "", customTimeRange: "" }))}
                      onChangeCustomDate={customDate => setRescheduleForm(current => ({ ...current, customDate, newSlotId: "", customTimeRange: "" }))}
                      onChangeSlot={newSlotId => setRescheduleForm(current => ({ ...current, newSlotId, customTimeRange: newSlotId === CUSTOM_SLOT_OPTION_VALUE ? current.customTimeRange : "" }))}
                      onChangeCustomTimeRange={customTimeRange => setRescheduleForm(current => ({ ...current, customTimeRange }))}
                      onChangeNote={note => setRescheduleForm(current => ({ ...current, note }))}
                      onChangeHasInspectionCompany={hasInspectionCompany => setRescheduleForm(current => ({ ...current, hasInspectionCompany }))}
                      onSyncAvailability={syncRescheduleAvailability}
                      onSubmit={submitReschedule}
                      onCancel={cancelEditingBooking}
                    />

                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteTarget?.step === 2 ? "第二次確認：即將永久刪除" : "第一次確認：準備刪除資料"}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.step === 2
                ? `你現在要永久刪除「${deleteTarget?.label}」。若目標是公司或建案，系統會連同其下住戶聯絡人、預約連結、時段、預約與改期紀錄一起真刪除。這一步沒有回復鈕。`
                : `你即將刪除「${deleteTarget?.label}」。系統依你的規則要求兩次確認，先提醒你：停止連結可保留資料，只有真的確定不要這筆資料時才進入下一步。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <Button variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {deleteTarget?.step === 2 ? "我已確認，永久刪除" : "進入第二次確認"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
