import { useMemo, useState } from "react";
import { redirectToAdminDashboardAfterLogin } from "@/lib/adminRedirect";
import { DEFAULT_SLOT_PRESETS, createProjectSlug } from "@/lib/adminConfig";
import { buildCompanyFormFromRecord, createEmptyCompanyForm } from "@/lib/companyEditor";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LockKeyhole, Building2, CalendarRange, ClipboardList, Users, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

function formatDateTime(value: string | number | Date) {
  return new Date(value).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseFaq(text: string) {
  return text
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

export default function AdminPage() {
  const utils = trpc.useUtils();
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [companyForm, setCompanyForm] = useState(createEmptyCompanyForm());
  const [projectForm, setProjectForm] = useState({
    companyId: "",
    name: "",
    unitFormatHint: "",
    houseNumberExample: "",
    address: "",
  });
  const [residentForm, setResidentForm] = useState({
    companyId: "",
    projectId: "",
    unitNumber: "",
    phoneNumber: "",
    note: "",
  });
  const [linkForm, setLinkForm] = useState({
    companyId: "",
    projectId: "",
    type: "initial",
    isEnabled: true,
    startsAt: "",
    endsAt: "",
    disabledReason: "",
  });
  const [slotForm, setSlotForm] = useState({
    companyId: "",
    projectId: "",
    slotDate: "",
    startLabel: "09:00",
    endLabel: "10:30",
    capacity: "1",
    isActive: true,
  });
  const [bookingFilters, setBookingFilters] = useState({ projectId: "", unitNumber: "", bookingType: "all", status: "all" });
  const [rescheduleForm, setRescheduleForm] = useState({ bookingId: "", newSlotId: "", note: "" });
  const [deleteTarget, setDeleteTarget] = useState<null | { type: "company" | "resident"; id: number; label: string }>(null);

  const adminProfile = trpc.adminAuth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const dashboardQuery = trpc.admin.dashboard.useQuery(undefined, {
    enabled: Boolean(adminProfile.data),
    refetchOnWindowFocus: false,
  });

  const bookingQuery = trpc.admin.searchBookings.useQuery(
    {
      projectId: bookingFilters.projectId ? Number(bookingFilters.projectId) : undefined,
      unitNumber: bookingFilters.unitNumber || undefined,
      bookingType: bookingFilters.bookingType === "all" ? undefined : (bookingFilters.bookingType as "initial" | "reinspect"),
      status: bookingFilters.status === "all" ? undefined : (bookingFilters.status as "booked" | "rescheduled" | "cancelled"),
    },
    {
      enabled: Boolean(adminProfile.data),
      refetchOnWindowFocus: false,
    }
  );

  const companies = dashboardQuery.data?.companies ?? [];
  const projects = dashboardQuery.data?.projects ?? [];
  const links = dashboardQuery.data?.links ?? [];
  const slots = dashboardQuery.data?.slots ?? [];
  const residents = dashboardQuery.data?.residents ?? [];
  const bookings = bookingQuery.data ?? [];

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
    onSuccess: async () => {
      toast.success("住戶資料已儲存");
      await refreshAll();
      setResidentForm({ companyId: "", projectId: "", unitNumber: "", phoneNumber: "", note: "" });
    },
    onError: error => toast.error(error.message),
  });

  const linkMutation = trpc.admin.saveLink.useMutation({
    onSuccess: async () => {
      toast.success("預約連結設定已儲存");
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const slotMutation = trpc.admin.saveSlot.useMutation({
    onSuccess: async () => {
      toast.success("時段已儲存");
      await refreshAll();
      setSlotForm({ companyId: "", projectId: "", slotDate: "", startLabel: "09:00", endLabel: "10:30", capacity: "1", isActive: true });
    },
    onError: error => toast.error(error.message),
  });

  const rescheduleMutation = trpc.admin.rescheduleBooking.useMutation({
    onSuccess: async () => {
      toast.success("預約已完成改期");
      await refreshAll();
      setRescheduleForm({ bookingId: "", newSlotId: "", note: "" });
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

  const residentDeleteMutation = trpc.admin.deleteResident.useMutation({
    onSuccess: async () => {
      toast.success("住戶資料已刪除");
      setDeleteTarget(null);
      await refreshAll();
    },
    onError: error => toast.error(error.message),
  });

  const projectOptions = useMemo(() => projects.map(project => ({ value: String(project.id), label: project.name })), [projects]);

  const startEditingCompany = (company: typeof companies[number]) => {
    setCompanyForm(buildCompanyFormFromRecord(company));
  };

  const cancelEditingCompany = () => {
    setCompanyForm(createEmptyCompanyForm());
  };

  const applySlotPreset = (startLabel: string, endLabel: string) => {
    setSlotForm(current => ({ ...current, startLabel, endLabel }));
  };

  const createPresetSlots = async () => {
    if (!slotForm.companyId || !slotForm.projectId || !slotForm.slotDate) {
      toast.error("請先選擇公司、建案與日期，再建立預設時段");
      return;
    }

    for (const preset of DEFAULT_SLOT_PRESETS) {
      await slotMutation.mutateAsync({
        companyId: Number(slotForm.companyId),
        projectId: Number(slotForm.projectId),
        slotDate: new Date(slotForm.slotDate),
        startLabel: preset.startLabel,
        endLabel: preset.endLabel,
        capacity: Number(slotForm.capacity),
        isActive: slotForm.isActive,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;

    if (deleteTarget.type === "company") {
      await companyDeleteMutation.mutateAsync({ id: deleteTarget.id });
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
            <Tabs defaultValue="companies" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="companies">公司</TabsTrigger>
                <TabsTrigger value="projects">建案</TabsTrigger>
                <TabsTrigger value="residents">住戶</TabsTrigger>
                <TabsTrigger value="schedule">連結與時段</TabsTrigger>
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
                                <Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "company", id: company.id, label: company.name })}>刪除</Button>
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
                      <TableHeader><TableRow><TableHead>建案</TableHead><TableHead>公司 ID</TableHead><TableHead>戶號範例</TableHead></TableRow></TableHeader>
                      <TableBody>{projects.map(project => <TableRow key={project.id}><TableCell>{project.name}</TableCell><TableCell>{project.companyId}</TableCell><TableCell>{project.houseNumberExample}</TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="residents" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>住戶資料管理</CardTitle><CardDescription>你現在要求逐筆新增。這樣做的風險是戶數一多時建立成本很高，之後最好補 CSV 匯入，不然正式案量一上來會卡死。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={residentForm.companyId} onChange={event => setResidentForm(current => ({ ...current, companyId: event.target.value }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={residentForm.projectId} onChange={event => setResidentForm(current => ({ ...current, projectId: event.target.value }))}><option value="">請選擇</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>標準戶號</Label><Input value={residentForm.unitNumber} onChange={event => setResidentForm(current => ({ ...current, unitNumber: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>手機號碼</Label><Input value={residentForm.phoneNumber} onChange={event => setResidentForm(current => ({ ...current, phoneNumber: event.target.value }))} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>備註</Label><Textarea value={residentForm.note} onChange={event => setResidentForm(current => ({ ...current, note: event.target.value }))} /></div>
                    <div className="md:col-span-2"><Button onClick={() => residentMutation.mutate({ ...residentForm, companyId: Number(residentForm.companyId), projectId: Number(residentForm.projectId) })} disabled={residentMutation.isPending}>{residentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}儲存住戶資料</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>住戶清單</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>戶號</TableHead><TableHead>手機</TableHead><TableHead>建案 ID</TableHead><TableHead>備註</TableHead><TableHead className="text-right">操作</TableHead></TableRow></TableHeader>
                      <TableBody>{residents.map(resident => <TableRow key={resident.id}><TableCell>{resident.unitNumber}</TableCell><TableCell>{resident.phoneNumber}</TableCell><TableCell>{resident.projectId}</TableCell><TableCell>{resident.note || "-"}</TableCell><TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setDeleteTarget({ type: "resident", id: resident.id, label: resident.unitNumber })}>刪除</Button></TableCell></TableRow>)}</TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schedule" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>預約連結管理</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.companyId} onChange={event => setLinkForm(current => ({ ...current, companyId: event.target.value }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.projectId} onChange={event => setLinkForm(current => ({ ...current, projectId: event.target.value }))}><option value="">請選擇</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>類型</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={linkForm.type} onChange={event => setLinkForm(current => ({ ...current, type: event.target.value }))}><option value="initial">初驗</option><option value="reinspect">複驗</option></select></div>
                    <div className="space-y-2"><Label>停用原因</Label><Input value={linkForm.disabledReason} onChange={event => setLinkForm(current => ({ ...current, disabledReason: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>開始時間</Label><Input type="datetime-local" value={linkForm.startsAt} onChange={event => setLinkForm(current => ({ ...current, startsAt: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>結束時間</Label><Input type="datetime-local" value={linkForm.endsAt} onChange={event => setLinkForm(current => ({ ...current, endsAt: event.target.value }))} /></div>
                    <div className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={linkForm.isEnabled} onChange={event => setLinkForm(current => ({ ...current, isEnabled: event.target.checked }))} /><span className="text-sm text-muted-foreground">目前啟用</span></div>
                    <div className="md:col-span-2"><Button onClick={() => linkMutation.mutate({ ...linkForm, type: linkForm.type as "initial" | "reinspect", companyId: Number(linkForm.companyId), projectId: Number(linkForm.projectId), startsAt: new Date(linkForm.startsAt), endsAt: new Date(linkForm.endsAt) })} disabled={linkMutation.isPending}>{linkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}儲存連結設定</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>時段管理</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                      <p className="text-sm font-medium">快速建立常用時段</p>
                      <p className="mt-2 text-sm text-muted-foreground">先選公司、建案、日期與名額後，可一鍵建立 09:00-10:30、10:30-12:00、14:00-15:30、15:30-17:00 四個時段；下方欄位仍保留手動編輯。</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {DEFAULT_SLOT_PRESETS.map(preset => (
                          <Button key={`${preset.startLabel}-${preset.endLabel}`} type="button" variant="outline" size="sm" onClick={() => applySlotPreset(preset.startLabel, preset.endLabel)}>
                            {preset.startLabel}-{preset.endLabel}
                          </Button>
                        ))}
                        <Button type="button" size="sm" onClick={createPresetSlots} disabled={slotMutation.isPending}>一鍵建立預設時段</Button>
                      </div>
                    </div>
                    <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.companyId} onChange={event => setSlotForm(current => ({ ...current, companyId: event.target.value }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={slotForm.projectId} onChange={event => setSlotForm(current => ({ ...current, projectId: event.target.value }))}><option value="">請選擇</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
                    <div className="space-y-2"><Label>日期</Label><Input type="date" value={slotForm.slotDate} onChange={event => setSlotForm(current => ({ ...current, slotDate: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>名額</Label><Input type="number" min="1" value={slotForm.capacity} onChange={event => setSlotForm(current => ({ ...current, capacity: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>開始</Label><Input value={slotForm.startLabel} onChange={event => setSlotForm(current => ({ ...current, startLabel: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>結束</Label><Input value={slotForm.endLabel} onChange={event => setSlotForm(current => ({ ...current, endLabel: event.target.value }))} /></div>
                    <div className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={slotForm.isActive} onChange={event => setSlotForm(current => ({ ...current, isActive: event.target.checked }))} /><span className="text-sm text-muted-foreground">啟用時段</span></div>
                    <div className="md:col-span-2"><Button onClick={() => slotMutation.mutate({ ...slotForm, companyId: Number(slotForm.companyId), projectId: Number(slotForm.projectId), slotDate: new Date(slotForm.slotDate), capacity: Number(slotForm.capacity) })} disabled={slotMutation.isPending}>{slotMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}儲存時段</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>目前連結與時段</CardTitle></CardHeader>
                  <CardContent className="grid gap-6 xl:grid-cols-2">
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>建案 ID</TableHead><TableHead>類型</TableHead><TableHead>啟用期間</TableHead></TableRow></TableHeader><TableBody>{links.map(link => <TableRow key={link.id}><TableCell>{link.projectId}</TableCell><TableCell>{link.type}</TableCell><TableCell>{formatDateTime(link.startsAt)} ~ {formatDateTime(link.endsAt)}</TableCell></TableRow>)}</TableBody></Table>
                    </div>
                    <div className="overflow-x-auto">
                      <Table><TableHeader><TableRow><TableHead>建案 ID</TableHead><TableHead>日期</TableHead><TableHead>時段</TableHead><TableHead>名額</TableHead></TableRow></TableHeader><TableBody>{slots.map(slot => <TableRow key={slot.id}><TableCell>{slot.projectId}</TableCell><TableCell>{formatDateTime(slot.slotDate)}</TableCell><TableCell>{slot.startLabel} - {slot.endLabel}</TableCell><TableCell>{slot.capacity}</TableCell></TableRow>)}</TableBody></Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bookings" className="space-y-6">
                <Card>
                  <CardHeader><CardTitle>預約紀錄查詢</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-4">
                    <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.projectId} onChange={event => setBookingFilters(current => ({ ...current, projectId: event.target.value }))}><option value="">全部</option>{projectOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                    <div className="space-y-2"><Label>戶號</Label><Input value={bookingFilters.unitNumber} onChange={event => setBookingFilters(current => ({ ...current, unitNumber: event.target.value }))} placeholder="可模糊查詢" /></div>
                    <div className="space-y-2"><Label>類型</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.bookingType} onChange={event => setBookingFilters(current => ({ ...current, bookingType: event.target.value }))}><option value="all">全部</option><option value="initial">初驗</option><option value="reinspect">複驗</option></select></div>
                    <div className="space-y-2"><Label>狀態</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={bookingFilters.status} onChange={event => setBookingFilters(current => ({ ...current, status: event.target.value }))}><option value="all">全部</option><option value="booked">booked</option><option value="rescheduled">rescheduled</option><option value="cancelled">cancelled</option></select></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>改期操作</CardTitle><CardDescription>改期後會自動保留原時段與新時段歷程。這樣做的風險是，如果你沒有同步通知住戶，現場還是會撞期。</CardDescription></CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2"><Label>預約 ID</Label><Input value={rescheduleForm.bookingId} onChange={event => setRescheduleForm(current => ({ ...current, bookingId: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>新時段 ID</Label><Input value={rescheduleForm.newSlotId} onChange={event => setRescheduleForm(current => ({ ...current, newSlotId: event.target.value }))} /></div>
                    <div className="space-y-2"><Label>備註</Label><Input value={rescheduleForm.note} onChange={event => setRescheduleForm(current => ({ ...current, note: event.target.value }))} /></div>
                    <div className="md:col-span-3"><Button onClick={() => rescheduleMutation.mutate({ bookingId: Number(rescheduleForm.bookingId), newSlotId: Number(rescheduleForm.newSlotId), note: rescheduleForm.note || undefined })} disabled={rescheduleMutation.isPending}>{rescheduleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}執行改期</Button></div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader><CardTitle>預約紀錄</CardTitle></CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>ID</TableHead><TableHead>公司 / 建案</TableHead><TableHead>戶號</TableHead><TableHead>類型</TableHead><TableHead>時段</TableHead><TableHead>狀態</TableHead></TableRow></TableHeader>
                      <TableBody>{bookings.map(booking => <TableRow key={booking.id}><TableCell>{booking.id}</TableCell><TableCell>{booking.companyName} / {booking.projectName}</TableCell><TableCell>{booking.unitNumberSnapshot}</TableCell><TableCell>{booking.bookingType}</TableCell><TableCell>{formatDateTime(booking.slotDate)} {booking.startLabel}-{booking.endLabel}</TableCell><TableCell>{booking.status}</TableCell></TableRow>)}</TableBody>
                    </Table>
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
            <AlertDialogTitle>確認刪除資料？</AlertDialogTitle>
            <AlertDialogDescription>
              你即將刪除「{deleteTarget?.label}」。這個操作不應該靠手滑完成，所以系統會要求你再確認一次。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>確認刪除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
