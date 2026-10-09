import React, { useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { trpc } from "@/lib/trpc";
import { Building2, CheckCircle2, CircleAlert, ClipboardList, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function getStatisticsLocator() {
  const search = new URLSearchParams(window.location.search);
  const linkToken = search.get("link") || undefined;
  const companySlug = search.get("company") || undefined;
  const projectSlug = search.get("project") || undefined;
  const type = (search.get("type") === "reinspect" ? "reinspect" : "initial") as "initial" | "reinspect";

  if (linkToken) return { hasTarget: true, params: { linkToken } };
  if (companySlug && projectSlug) return { hasTarget: true, params: { companySlug, projectSlug, type } };
  return { hasTarget: false, params: { companySlug: "", projectSlug: "", type } };
}

export default function StatisticsHome() {
  const pageRequest = useMemo(getStatisticsLocator, []);
  const params = pageRequest.params;
  const [unitNumber, setUnitNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verification, setVerification] = useState<any>(null);
  const [selectedOptionId, setSelectedOptionId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);

  const contextQuery = trpc.publicSite.getStatisticsContext.useQuery(params, {
    enabled: pageRequest.hasTarget,
    refetchOnWindowFocus: false,
  });

  const verifyMutation = trpc.publicSite.verifyStatisticsResident.useMutation({
    onSuccess: result => {
      setVerification(result);
      setSelectedOptionId(result.response?.optionId ? String(result.response.optionId) : "");
      setIsEditing(!result.response);
      toast.success("驗證成功，已載入你的目前作答狀態");
    },
    onError: error => {
      setVerification(null);
      setIsEditing(false);
      toast.error(error.message);
    },
  });

  const submitMutation = trpc.publicSite.submitStatisticsResponse.useMutation({
    onSuccess: async result => {
      if (!result.changed) {
        toast.info("已提交相同答案");
      } else {
        toast.success("答案已送出");
      }
      const refreshed = await verifyMutation.mutateAsync({
        ...params,
        unitNumber: unitNumber.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      setVerification(refreshed);
      setSelectedOptionId(refreshed.response?.optionId ? String(refreshed.response.optionId) : "");
      setIsEditing(false);
    },
    onError: error => toast.error(error.message),
  });

  if (!pageRequest.hasTarget) {
    return (
      <div className="min-h-screen bg-background p-6 text-foreground flex items-center justify-center">
        <Card className="w-full max-w-xl">
          <CardHeader><CardTitle>目前沒有可公開的統計連結</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">請向建設公司或通知窗口索取完整統計連結後，再重新開啟頁面。</CardContent>
        </Card>
      </div>
    );
  }

  if (contextQuery.isLoading) {
    return <div className="min-h-screen bg-background text-foreground flex items-center justify-center gap-3"><Loader2 className="h-5 w-5 animate-spin" />載入統計調查中...</div>;
  }

  const context = contextQuery.data;
  if (contextQuery.error || !context) {
    return (
      <div className="min-h-screen bg-background p-6 text-foreground flex items-center justify-center">
        <Card className="w-full max-w-xl border-destructive/30">
          <CardHeader><CardTitle>找不到對應的統計調查</CardTitle><CardDescription>請確認使用的是後台產生的完整分享網址。</CardDescription></CardHeader>
        </Card>
      </div>
    );
  }

  const { company, project, link, activeOptions, isWritable } = context;
  const hasActiveOptions = activeOptions.length > 0;
  const currentResponse = verification?.response ?? null;
  const mayEdit = Boolean(isWritable && hasActiveOptions);

  const submit = async () => {
    if (!verification?.resident) {
      toast.error("請先完成住戶驗證");
      return;
    }
    const optionId = Number(selectedOptionId);
    if (!Number.isInteger(optionId) || optionId <= 0) {
      toast.error("請選擇一個答案");
      return;
    }
    const selectedOption = activeOptions.find(option => option.id === optionId);
    if (!selectedOption) {
      toast.error("請重新選擇目前可用的選項");
      return;
    }
    if (!window.confirm(`確認要送出「${selectedOption.name}」嗎？送出後仍可在開放期間內修改。`)) return;
    await submitMutation.mutateAsync({ ...params, residentId: verification.resident.id, optionId });
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f5f6f4_0%,#ffffff_38%,#f8f7f4_100%)] text-foreground">
      <section className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(87,116,104,0.28),transparent_42%),linear-gradient(135deg,#183d38_0%,#315f56_48%,#887253_100%)] text-white">
        <div className="container py-12 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_0.85fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3"><Badge className="border-white/20 bg-white/12 text-white hover:bg-white/12">統計數量調查</Badge><Badge className={isWritable ? "border-emerald-200/40 bg-emerald-200/15 text-white hover:bg-emerald-200/15" : "border-destructive/40 bg-destructive/15 text-white hover:bg-destructive/15"}>{isWritable ? "開放填答" : "目前僅供查看"}</Badge></div>
              <div className="flex items-center gap-4">
                <div className="rounded-2xl bg-white/90 p-3 shadow-lg"><img src={company.logoUrl} alt={company.name} className="h-16 w-auto object-contain" /></div>
                <div><p className="text-sm uppercase tracking-[0.28em] text-white/70">Resident Service Platform</p><h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{link.statisticsTitle}</h1></div>
              </div>
              <p className="max-w-2xl whitespace-pre-line text-base leading-7 text-white/85 md:text-lg">{link.statisticsDescription || "請完成身分驗證後，選擇一個符合目前狀況的答案。"}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"><p className="text-sm text-white/70">建設公司</p><p className="mt-2 text-lg font-medium">{company.name}</p></div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm"><p className="text-sm text-white/70">建案名稱</p><p className="mt-2 text-lg font-medium">{project.name}</p></div>
              </div>
            </div>
            <Card className="border-white/15 bg-white/92 text-card-foreground shadow-2xl">
              <CardHeader><CardTitle>住戶身分驗證</CardTitle><CardDescription>請輸入戶別與該戶任一支已登記手機號碼。驗證後只能查看及填寫自己的答案。</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2"><Label htmlFor="statistics-unit-number">標準戶號</Label><Input id="statistics-unit-number" value={unitNumber} onChange={event => setUnitNumber(event.target.value)} placeholder={project.houseNumberExample} /><p className="text-xs text-muted-foreground">格式提示：{project.unitFormatHint}</p></div>
                <div className="space-y-2"><Label htmlFor="statistics-phone-number">手機號碼</Label><Input id="statistics-phone-number" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="請輸入該戶任一已登記手機號碼" /></div>
                <Button className="w-full" onClick={() => verifyMutation.mutate({ ...params, unitNumber: unitNumber.trim(), phoneNumber: phoneNumber.trim() })} disabled={verifyMutation.isPending}>{verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}進行住戶驗證</Button>
                {!isWritable ? <Alert className="border-amber-300/60 bg-amber-50 text-amber-950"><CircleAlert className="h-4 w-4" /><AlertTitle>目前無法新增或修改</AlertTitle><AlertDescription>此統計連結尚未開放、已截止或已停止；完成驗證後仍可查看自己的目前答案。</AlertDescription></Alert> : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <main className="container py-10 md:py-14">
        <div className="mx-auto max-w-3xl">
          <Card className="border-border/70 shadow-lg">
            <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />我的統計答案</CardTitle><CardDescription>每一戶在本調查中只能保留一個目前有效答案。同戶不同手機驗證後會看到相同答案。</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              {!verification ? <Alert><CircleAlert className="h-4 w-4" /><AlertTitle>尚未完成驗證</AlertTitle><AlertDescription>系統不會顯示其他戶別或全體統計數量；請先完成驗證。</AlertDescription></Alert> : (
                <>
                  <div className="flex items-center justify-between rounded-2xl bg-muted/40 p-4"><div><p className="text-sm text-muted-foreground">驗證戶別</p><p className="text-lg font-semibold">{verification.resident.unitNumber}</p></div><Badge variant="outline"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />驗證成功</Badge></div>
                  {currentResponse && !isEditing ? <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5"><div><p className="text-sm text-muted-foreground">目前答案</p><p className="mt-1 text-xl font-semibold">{currentResponse.optionName}</p></div>{mayEdit ? <Button variant="outline" onClick={() => { setSelectedOptionId(String(currentResponse.optionId)); setIsEditing(true); }}>修改答案</Button> : <p className="text-sm text-muted-foreground">目前連結不可填答，因此答案僅供查看。</p>}</div> : (
                    <div className="space-y-5">
                      {!hasActiveOptions ? <Alert className="border-amber-300/60 bg-amber-50 text-amber-950"><CircleAlert className="h-4 w-4" /><AlertTitle>目前沒有可選選項</AlertTitle><AlertDescription>管理員暫時停用了所有選項。若你已有答案，系統仍會保留並顯示目前答案。</AlertDescription></Alert> : !isWritable ? <Alert><CircleAlert className="h-4 w-4" /><AlertTitle>目前不能填答</AlertTitle><AlertDescription>此統計連結目前僅供查看。</AlertDescription></Alert> : <><RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId} className="space-y-3">{activeOptions.map(option => <Label key={option.id} htmlFor={`statistics-option-${option.id}`} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-4 hover:bg-muted/40"><RadioGroupItem value={String(option.id)} id={`statistics-option-${option.id}`} /><span>{option.name}</span></Label>)}</RadioGroup><div className="flex flex-wrap gap-3"><Button onClick={submit} disabled={submitMutation.isPending}>{submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}確認送出</Button>{currentResponse ? <Button variant="outline" onClick={() => setIsEditing(false)}>取消修改</Button> : null}</div></>}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />本頁不會顯示全體統計數量、其他戶別或完整修改歷程。</p>
        </div>
      </main>
    </div>
  );
}
