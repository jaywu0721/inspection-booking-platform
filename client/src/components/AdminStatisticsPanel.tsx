import React, { useEffect, useMemo, useState } from "react";
import { downloadStatisticsExportWorkbook } from "@/lib/statisticsExport";
import { trpc } from "@/lib/trpc";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MoveDown, MoveUp, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Company = { id: number; name: string };
type Project = { id: number; companyId: number; name: string };
type StatisticsLink = {
  id: number;
  companyId: number;
  projectId: number;
  mode: "inspection" | "statistics";
  shareToken: string;
  statisticsTitle: string | null;
  statisticsDescription: string | null;
  isEnabled: boolean;
  startsAt: string | number | Date;
  endsAt: string | number | Date;
};

function formatDateTimeInput(value: string | number | Date) {
  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function createEmptyForm() {
  return {
    id: undefined as number | undefined,
    companyId: "",
    projectId: "",
    title: "",
    description: "",
    startsAt: "",
    endsAt: "",
    isEnabled: true,
  };
}

export function AdminStatisticsPanel({ companies, projects, links, onRefresh }: { companies: Company[]; projects: Project[]; links: StatisticsLink[]; onRefresh: () => Promise<void> }) {
  const utils = trpc.useUtils();
  const statisticsLinks = useMemo(() => links.filter(link => link.mode === "statistics"), [links]);
  const [form, setForm] = useState(createEmptyForm());
  const [initialOptions, setInitialOptions] = useState(["", ""]);
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const [newOptionName, setNewOptionName] = useState("");
  const [optionDrafts, setOptionDrafts] = useState<Record<number, { name: string; isActive: boolean }>>({});
  const [unitSearch, setUnitSearch] = useState("");
  const [selectedResidentId, setSelectedResidentId] = useState("");
  const [adminOptionId, setAdminOptionId] = useState("");
  const [adminReason, setAdminReason] = useState("");

  const projectOptions = useMemo(() => projects.filter(project => String(project.companyId) === form.companyId), [projects, form.companyId]);
  const selectedLink = statisticsLinks.find(link => String(link.id) === selectedLinkId) ?? null;

  const optionsQuery = trpc.admin.getStatisticOptions.useQuery(
    { linkId: Number(selectedLinkId) },
    { enabled: Boolean(selectedLinkId), refetchOnWindowFocus: false }
  );
  const resultsQuery = trpc.admin.getStatisticResults.useQuery(
    { linkId: Number(selectedLinkId) },
    { enabled: Boolean(selectedLinkId), refetchOnWindowFocus: false }
  );
  const residentsQuery = trpc.admin.searchStatisticResidents.useQuery(
    { linkId: Number(selectedLinkId), unitNumber: unitSearch.trim() || undefined },
    { enabled: Boolean(selectedLinkId && unitSearch.trim()), refetchOnWindowFocus: false }
  );

  useEffect(() => {
    const nextDrafts: Record<number, { name: string; isActive: boolean }> = {};
    (optionsQuery.data ?? []).forEach(option => {
      nextDrafts[option.id] = { name: option.name, isActive: option.isActive };
    });
    setOptionDrafts(nextDrafts);
  }, [optionsQuery.data]);

  const refreshStatistics = async () => {
    await Promise.all([
      onRefresh(),
      utils.admin.getStatisticOptions.invalidate(),
      utils.admin.getStatisticResults.invalidate(),
      utils.admin.searchStatisticResidents.invalidate(),
    ]);
  };

  const saveLinkMutation = trpc.admin.saveStatisticsLink.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(variables.id ? "統計連結已更新" : "統計連結已建立");
      await refreshStatistics();
      setForm(createEmptyForm());
      setInitialOptions(["", ""]);
    },
    onError: error => toast.error(error.message),
  });
  const createOptionMutation = trpc.admin.createStatisticOption.useMutation({ onSuccess: async () => { setNewOptionName(""); await refreshStatistics(); toast.success("統計選項已新增"); }, onError: error => toast.error(error.message) });
  const updateOptionMutation = trpc.admin.updateStatisticOption.useMutation({ onSuccess: async () => { await refreshStatistics(); toast.success("統計選項已更新"); }, onError: error => toast.error(error.message) });
  const deleteOptionMutation = trpc.admin.deleteStatisticOption.useMutation({ onSuccess: async () => { await refreshStatistics(); toast.success("統計選項已刪除"); }, onError: error => toast.error(error.message) });
  const reorderOptionsMutation = trpc.admin.reorderStatisticOptions.useMutation({ onSuccess: async () => { await refreshStatistics(); }, onError: error => toast.error(error.message) });
  const submitResponseMutation = trpc.admin.submitStatisticResponse.useMutation({ onSuccess: async result => { await refreshStatistics(); toast.success(result.changed ? "已完成管理員代填／修改" : "住戶目前已是相同答案"); }, onError: error => toast.error(error.message) });
  const toggleLinkMutation = trpc.admin.toggleLinkEnabled.useMutation({ onSuccess: async (_result, variables) => { await refreshStatistics(); toast.success(variables.isEnabled ? "統計連結已重新啟用" : "統計連結已停止"); }, onError: error => toast.error(error.message) });
  const deleteLinkMutation = trpc.admin.deleteLink.useMutation({ onSuccess: async () => { await refreshStatistics(); setSelectedLinkId(""); toast.success("未填答的統計連結已刪除"); }, onError: error => toast.error(error.message) });

  const saveLink = () => {
    if (!form.companyId || !form.projectId || !form.title.trim() || !form.startsAt || !form.endsAt) {
      toast.error("請填寫公司、建案、統計連結名稱與完整開放時間");
      return;
    }
    if (new Date(form.endsAt).getTime() <= new Date(form.startsAt).getTime()) {
      toast.error("連結結束時間必須晚於開始時間");
      return;
    }
    const optionNames = initialOptions.map(option => option.trim());
    if (!form.id && (optionNames.length < 2 || optionNames.some(option => !option))) {
      toast.error("建立統計連結時至少要填寫兩個啟用選項");
      return;
    }
    saveLinkMutation.mutate({
      id: form.id,
      companyId: Number(form.companyId),
      projectId: Number(form.projectId),
      title: form.title.trim(),
      description: form.description.trim(),
      startsAt: new Date(form.startsAt),
      endsAt: new Date(form.endsAt),
      isEnabled: form.isEnabled,
      initialOptionNames: form.id ? undefined : optionNames,
    });
  };

  const startEditingLink = (link: StatisticsLink) => {
    setForm({
      id: link.id,
      companyId: String(link.companyId),
      projectId: String(link.projectId),
      title: link.statisticsTitle ?? "",
      description: link.statisticsDescription ?? "",
      startsAt: formatDateTimeInput(link.startsAt),
      endsAt: formatDateTimeInput(link.endsAt),
      isEnabled: link.isEnabled,
    });
    setSelectedLinkId(String(link.id));
  };

  const moveOption = (optionId: number, direction: -1 | 1) => {
    const ids = (optionsQuery.data ?? []).map(option => option.id);
    const index = ids.indexOf(optionId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderOptionsMutation.mutate({ linkId: Number(selectedLinkId), optionIds: ids });
  };

  const submitAdminResponse = () => {
    if (!selectedLinkId || !selectedResidentId || !adminOptionId) {
      toast.error("請先搜尋並選擇戶別，再選擇要代填的統計選項");
      return;
    }
    submitResponseMutation.mutate({ linkId: Number(selectedLinkId), residentId: Number(selectedResidentId), optionId: Number(adminOptionId), reason: adminReason.trim() });
  };

  const activeOptions = (optionsQuery.data ?? []).filter(option => option.isActive);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>統計數量連結管理</CardTitle><CardDescription>統計連結與驗屋時段完全分開。建立時至少要有兩個啟用選項；已有答案或歷程的連結只能停止，不能真刪除。</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><Label>公司</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.companyId} onChange={event => setForm(current => ({ ...current, companyId: event.target.value, projectId: "" }))}><option value="">請選擇</option>{companies.map(company => <option key={company.id} value={company.id}>{company.name}</option>)}</select></div>
          <div className="space-y-2"><Label>建案</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.projectId} onChange={event => setForm(current => ({ ...current, projectId: event.target.value }))} disabled={!form.companyId || Boolean(form.id)}><option value="">請選擇</option>{projectOptions.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></div>
          <div className="space-y-2 md:col-span-2"><Label>統計連結名稱</Label><Input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} placeholder="例如：第一次區權會出席意願調查" /></div>
          <div className="space-y-2 md:col-span-2"><Label>前台調查說明（選填）</Label><Textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} placeholder="住戶前台會顯示這段說明" /></div>
          <div className="space-y-2"><Label>開始時間</Label><Input type="datetime-local" value={form.startsAt} onChange={event => setForm(current => ({ ...current, startsAt: event.target.value }))} /></div>
          <div className="space-y-2"><Label>結束時間</Label><Input type="datetime-local" value={form.endsAt} onChange={event => setForm(current => ({ ...current, endsAt: event.target.value }))} /></div>
          <label className="flex items-center gap-3 md:col-span-2"><input type="checkbox" checked={form.isEnabled} onChange={event => setForm(current => ({ ...current, isEnabled: event.target.checked }))} /><span className="text-sm text-muted-foreground">目前啟用</span></label>
          {!form.id ? <div className="space-y-3 md:col-span-2"><Label>初始統計選項（至少兩項）</Label>{initialOptions.map((option, index) => <Input key={index} value={option} onChange={event => setInitialOptions(current => current.map((value, position) => position === index ? event.target.value : value))} placeholder={`選項 ${index + 1}`} />)}<Button variant="outline" size="sm" onClick={() => setInitialOptions(current => [...current, ""])}><Plus className="h-4 w-4" />增加選項欄位</Button></div> : null}
          <div className="flex flex-wrap gap-3 md:col-span-2"><Button onClick={saveLink} disabled={saveLinkMutation.isPending}>{saveLinkMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{form.id ? "更新統計連結" : "建立統計連結"}</Button>{form.id ? <Button variant="outline" onClick={() => { setForm(createEmptyForm()); setInitialOptions(["", ""]); }}>取消編輯</Button> : null}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>已建立的統計連結</CardTitle></CardHeader>
        <CardContent className="space-y-3">{statisticsLinks.length === 0 ? <p className="text-sm text-muted-foreground">尚未建立統計連結。</p> : statisticsLinks.map(link => { const shareUrl = `${window.location.origin}/?link=${link.shareToken}`; return <div key={link.id} className="space-y-3 rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{link.statisticsTitle}</p><p className="text-sm text-muted-foreground">#{link.id} · {projects.find(project => project.id === link.projectId)?.name ?? `建案 ${link.projectId}`}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant={link.isEnabled ? "outline" : "secondary"}>{link.isEnabled ? "啟用中" : "已停止"}</Badge><Button variant="outline" size="sm" onClick={() => { setSelectedLinkId(String(link.id)); }}>選取管理</Button><Button variant="outline" size="sm" onClick={() => startEditingLink(link)}>編輯</Button><Button variant="outline" size="sm" onClick={() => toggleLinkMutation.mutate({ id: link.id, isEnabled: !link.isEnabled, disabledReason: "此統計連結已由後台停止" })}>{link.isEnabled ? "停止" : "重新啟用"}</Button><Button variant="outline" size="sm" onClick={() => { if (!window.confirm("確定要刪除這個統計連結嗎？沒有回覆的連結才可刪除。")) return; if (!window.confirm("刪除後無法復原。確定繼續？")) return; deleteLinkMutation.mutate({ id: link.id }); }}>刪除</Button></div></div><div className="flex flex-wrap items-center gap-2"><p className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{shareUrl}</p><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); toast.success("統計連結已複製"); } catch { toast.error("瀏覽器無法直接複製，請手動複製網址"); } }}>複製網址</Button><Button variant="outline" size="sm" onClick={() => window.open(shareUrl, "_blank", "noopener,noreferrer")}>開啟</Button></div></div>; })}</CardContent>
      </Card>

      {selectedLink ? <>
        <Card>
          <CardHeader><CardTitle>統計選項管理：{selectedLink.statisticsTitle}</CardTitle><CardDescription>停用後不會接受新答案，但既有答案仍會保留在統計結果。所有選項都可以停用；此時住戶只能查看舊答案。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2"><Input value={newOptionName} onChange={event => setNewOptionName(event.target.value)} placeholder="新增統計選項" /><Button onClick={() => { if (!newOptionName.trim()) { toast.error("請先填寫選項名稱"); return; } createOptionMutation.mutate({ linkId: Number(selectedLinkId), name: newOptionName.trim() }); }} disabled={createOptionMutation.isPending}><Plus className="h-4 w-4" />新增</Button></div>
            <div className="space-y-3">{(optionsQuery.data ?? []).map((option, index) => { const draft = optionDrafts[option.id] ?? { name: option.name, isActive: option.isActive }; return <div key={option.id} className="grid gap-3 rounded-xl border border-border p-3 md:grid-cols-[1fr_auto_auto_auto] md:items-center"><Input value={draft.name} onChange={event => setOptionDrafts(current => ({ ...current, [option.id]: { ...draft, name: event.target.value } }))} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isActive} onChange={event => setOptionDrafts(current => ({ ...current, [option.id]: { ...draft, isActive: event.target.checked } }))} />啟用</label><div className="flex gap-1"><Button size="icon" variant="outline" aria-label="上移選項" disabled={index === 0 || reorderOptionsMutation.isPending} onClick={() => moveOption(option.id, -1)}><MoveUp className="h-4 w-4" /></Button><Button size="icon" variant="outline" aria-label="下移選項" disabled={index === (optionsQuery.data?.length ?? 1) - 1 || reorderOptionsMutation.isPending} onClick={() => moveOption(option.id, 1)}><MoveDown className="h-4 w-4" /></Button></div><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => updateOptionMutation.mutate({ id: option.id, linkId: Number(selectedLinkId), name: draft.name, isActive: draft.isActive })}>儲存</Button><Button size="icon" variant="outline" aria-label="刪除選項" onClick={() => { if (!window.confirm(`確定要刪除「${option.name}」嗎？`)) return; if (!window.confirm("刪除後無法復原；若已被答案或歷程引用，系統會拒絕刪除。確定繼續？")) return; deleteOptionMutation.mutate({ id: option.id, linkId: Number(selectedLinkId) }); }}><Trash2 className="h-4 w-4" /></Button></div></div>; })}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>統計結果</CardTitle><CardDescription>只顯示各選項統計數量與點選戶別；不提供總戶數、回覆率或未回覆名單。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => { const results = resultsQuery.data; if (!results) return; void downloadStatisticsExportWorkbook({ projectName: projects.find(project => project.id === selectedLink.projectId)?.name ?? "建案", title: selectedLink.statisticsTitle ?? "統計結果", options: results.options }); }} disabled={!resultsQuery.data}>下載統計 Excel</Button>{resultsQuery.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}</div>
            {(resultsQuery.data?.options ?? []).map(option => <div key={option.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">{option.name}{!option.isActive ? <Badge variant="secondary" className="ml-2">已停用</Badge> : null}</p><Badge>{option.count} 戶</Badge></div><div className="mt-3 flex flex-wrap gap-2">{option.units.length === 0 ? <span className="text-sm text-muted-foreground">尚無住戶選擇此選項。</span> : option.units.map(unit => <Badge key={unit.unitNumber} variant="outline">{unit.unitNumber}</Badge>)}</div></div>)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>管理員代填／修改</CardTitle><CardDescription>搜尋既有戶別後可代填或修改。不建立未回覆統計清單；管理員可在連結停止或截止後協助處理。</CardDescription></CardHeader>
          <CardContent className="space-y-4"><div className="flex gap-2"><Input value={unitSearch} onChange={event => { setUnitSearch(event.target.value); setSelectedResidentId(""); }} placeholder="輸入戶別搜尋" /><Button variant="outline" disabled><Search className="h-4 w-4" />搜尋</Button></div>{unitSearch.trim() ? <div className="space-y-2">{(residentsQuery.data ?? []).map(resident => <label key={resident.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3"><input type="radio" checked={selectedResidentId === String(resident.id)} onChange={() => setSelectedResidentId(String(resident.id))} />{resident.unitNumber}</label>)}{residentsQuery.data?.length === 0 ? <p className="text-sm text-muted-foreground">找不到相符戶別。</p> : null}</div> : <Alert><AlertTitle>請先輸入戶別</AlertTitle><AlertDescription>為避免把整份住戶名冊無差別展開，代填操作採搜尋既有戶別。</AlertDescription></Alert>}<div className="space-y-2"><Label>代填選項</Label><select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={adminOptionId} onChange={event => setAdminOptionId(event.target.value)}><option value="">請選擇</option>{activeOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></div><div className="space-y-2"><Label>修改原因（選填）</Label><Textarea value={adminReason} onChange={event => setAdminReason(event.target.value)} placeholder="例如：電話確認後由管理員代填" /></div><Button onClick={submitAdminResponse} disabled={submitResponseMutation.isPending}>{submitResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}確認代填／修改</Button></CardContent>
        </Card>
      </> : <Alert><AlertTitle>請先選取統計連結</AlertTitle><AlertDescription>選取連結後，才能管理其選項、查看結果或代填住戶答案。</AlertDescription></Alert>}
    </div>
  );
}
