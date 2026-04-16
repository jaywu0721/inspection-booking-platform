import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, CalendarDays, Building2, Phone, ShieldCheck, CircleAlert } from "lucide-react";
import { toast } from "sonner";

function formatDate(dateValue: string | Date) {
  return new Date(dateValue).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

export default function Home() {
  const params = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      companySlug: search.get("company") || "yisin",
      projectSlug: search.get("project") || "yisin-demo",
      type: (search.get("type") === "reinspect" ? "reinspect" : "initial") as "initial" | "reinspect",
    };
  }, []);

  const [unitNumber, setUnitNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gmail, setGmail] = useState("");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [hasInspectionCompany, setHasInspectionCompany] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const siteQuery = trpc.publicSite.getContext.useQuery(params, {
    refetchOnWindowFocus: false,
  });

  const verifyMutation = trpc.publicSite.verifyResident.useMutation({
    onSuccess: result => {
      setVerificationResult(result);
      toast.success("驗證成功，已載入既有預約與可用時段");
    },
    onError: error => {
      setVerificationResult(null);
      toast.error(error.message);
    },
  });

  const createBookingMutation = trpc.publicSite.createBooking.useMutation({
    onSuccess: async () => {
      toast.success("預約已送出");
      if (!verificationResult?.resident) return;
      const refreshed = await verifyMutation.mutateAsync({
        ...params,
        unitNumber,
        phoneNumber,
      });
      setVerificationResult(refreshed);
      setGmail("");
      setHasInspectionCompany(false);
      setSlotId(null);
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const site = siteQuery.data;

  const submitVerification = async () => {
    await verifyMutation.mutateAsync({
      ...params,
      unitNumber: unitNumber.trim(),
      phoneNumber: phoneNumber.trim(),
    });
  };

  const submitBooking = async () => {
    if (!verificationResult?.resident) {
      toast.error("請先完成住戶驗證");
      return;
    }
    if (!slotId) {
      toast.error("請先選擇預約時段");
      return;
    }

    await createBookingMutation.mutateAsync({
      ...params,
      residentId: verificationResult.resident.id,
      slotId,
      gmail,
      hasInspectionCompany,
    });
  };

  if (siteQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>載入品牌與預約資料中...</span>
        </div>
      </div>
    );
  }

  if (siteQuery.error || !site) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl border-destructive/30">
          <CardHeader>
            <CardTitle>找不到對應的預約頁面</CardTitle>
            <CardDescription>
              這個連結格式有問題。你有沒有想過，如果公司、建案與類型參數不一致，住戶根本進不來。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>建議改成固定格式，例如：<code>?company=yisin&project=yisin-demo&type=initial</code></p>
            <p>系統目前也提供兩組示範連結可用來驗證品牌切換。</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline"><a href="/?company=yisin&project=yisin-demo&type=initial">鷁欣建設示範連結</a></Button>
              <Button asChild variant="outline"><a href="/?company=yiqi&project=yiqi-demo&type=initial">鷁崎建設示範連結</a></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = site.company;
  const project = site.project;
  const availableSlots: any[] = verificationResult?.site.availableSlots ?? site.availableSlots ?? [];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f1ea_0%,#ffffff_38%,#f8f7f4_100%)] text-foreground">
      <section className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(140,109,85,0.16),transparent_38%),linear-gradient(135deg,#15303a_0%,#294550_38%,#8d6c53_100%)] text-white">
        <div className="container py-12 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-white/12 text-white border-white/20 hover:bg-white/12">{params.type === "initial" ? "初驗預約" : "複驗預約"}</Badge>
                <Badge className="bg-white/12 text-white border-white/20 hover:bg-white/12">品牌動態載入</Badge>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-white/90 p-3 shadow-lg">
                    <img src={company.logoUrl} alt={company.name} className="h-16 w-auto object-contain" />
                  </div>
                  <div>
                    <p className="text-sm uppercase tracking-[0.28em] text-white/70">Inspection Booking Platform</p>
                    <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{company.heroTitle}</h1>
                  </div>
                </div>
                <p className="max-w-2xl text-base leading-7 text-white/82 md:text-lg">{company.heroDescription}</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-sm text-white/70">建設公司</p>
                  <p className="mt-2 text-lg font-medium">{company.name}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-sm text-white/70">建案名稱</p>
                  <p className="mt-2 text-lg font-medium">{project.name}</p>
                </div>
                <div className="rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-sm">
                  <p className="text-sm text-white/70">聯絡電話</p>
                  <p className="mt-2 text-lg font-medium">{company.contactPhone}</p>
                </div>
              </div>
            </div>
            <Card className="border-white/15 bg-white/92 text-card-foreground shadow-2xl">
              <CardHeader>
                <CardTitle>快速進入預約驗證</CardTitle>
                <CardDescription>系統會先檢查戶號與手機，再開放查看既有預約與可選時段。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="unitNumber">標準戶號</Label>
                  <Input id="unitNumber" value={unitNumber} onChange={event => setUnitNumber(event.target.value)} placeholder={project.houseNumberExample} />
                  <p className="text-xs text-muted-foreground">格式提示：{project.unitFormatHint}。範例：{project.houseNumberExample}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">手機號碼</Label>
                  <Input id="phoneNumber" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="請輸入完整手機號碼" />
                </div>
                <Button className="w-full" onClick={submitVerification} disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  進行住戶驗證
                </Button>
                {site.isExpired ? (
                  <Alert className="border-destructive/30 bg-destructive/5">
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>連結已截止</AlertTitle>
                    <AlertDescription>這個初驗／複驗連結目前未啟用或已超過可預約期間，請聯絡建案窗口處理。</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <main className="container py-10 md:py-14">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.95fr]">
          <div className="space-y-8">
            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> 驗屋流程說明</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-7 text-muted-foreground">{company.inspectionFlow}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> 交屋流程說明</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-7 text-muted-foreground">{company.handoverFlow}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>驗屋注意事項</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-line leading-7 text-muted-foreground">{company.precautions}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>常見問答</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {company.faqItems.map((item, index) => (
                    <AccordionItem key={`${item.question}-${index}`} value={`faq-${index}`}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent className="leading-7 text-muted-foreground">{item.answer}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> 聯絡窗口</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-line leading-7 text-muted-foreground">{company.contactWindow}</p>
                <Separator />
                <div className="text-sm text-muted-foreground">
                  <p>聯絡電話：{company.contactPhone}</p>
                  {company.contactEmail ? <p>聯絡 Email：{company.contactEmail}</p> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
            <Card className="border-border/70 shadow-lg">
              <CardHeader>
                <CardTitle>預約查詢與送出</CardTitle>
                <CardDescription>驗證成功後，這一區會顯示既有紀錄與可用時段。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!verificationResult ? (
                  <Alert>
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>尚未完成驗證</AlertTitle>
                    <AlertDescription>先完成戶號與手機驗證，否則住戶資料與可用時段不會顯示。這樣做的目的，是避免未授權的人直接看見建案排程。</AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <div className="space-y-3 rounded-2xl bg-muted/40 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">驗證住戶</p>
                          <p className="text-lg font-semibold">{verificationResult.resident.unitNumber}</p>
                        </div>
                        <Badge variant="outline">驗證成功</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">手機：{verificationResult.resident.phoneNumber}</p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">既有預約紀錄</h3>
                        <Badge variant="secondary">{verificationResult.existingBookings.length} 筆</Badge>
                      </div>
                      {verificationResult.existingBookings.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">目前尚無既有預約紀錄。</div>
                      ) : (
                        <div className="space-y-3">
                          {verificationResult.existingBookings.map((booking: any) => (
                            <div key={booking.id} className="rounded-2xl border border-border/80 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="font-medium">{booking.projectName}</p>
                                  <p className="text-sm text-muted-foreground">{booking.bookingType === "initial" ? "初驗" : "複驗"}｜{booking.status}</p>
                                </div>
                                <Badge variant="outline">{formatDate(booking.slotDate)}</Badge>
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">時段：{booking.startLabel} - {booking.endLabel}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold">選擇新的預約時段</h3>
                      <div className="space-y-3">
                        {availableSlots.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">目前尚未開放可用時段，請聯絡窗口安排。</div>
                        ) : (
                          availableSlots.map((slot: any) => {
                            const isFull = slot.remaining <= 0;
                            const isSelected = slotId === slot.id;
                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => !isFull && setSlotId(slot.id)}
                                className={`w-full rounded-2xl border p-4 text-left transition ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "border-border/80 hover:border-primary/40"} ${isFull ? "cursor-not-allowed opacity-55" : ""}`}
                                disabled={isFull}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="font-medium">{formatDate(slot.slotDate)}</p>
                                    <p className="text-sm text-muted-foreground">{slot.startLabel} - {slot.endLabel}</p>
                                  </div>
                                  <Badge variant={isFull ? "destructive" : "secondary"}>{isFull ? "已額滿" : `剩餘 ${slot.remaining} 名`}</Badge>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="gmail">Gmail</Label>
                        <Input id="gmail" type="email" value={gmail} onChange={event => setGmail(event.target.value)} placeholder="yourname@gmail.com" />
                      </div>
                      <label className="flex items-center gap-3 rounded-2xl border border-border/70 p-4">
                        <Checkbox checked={hasInspectionCompany} onCheckedChange={checked => setHasInspectionCompany(Boolean(checked))} />
                        <span className="text-sm text-muted-foreground">此次驗屋是否會由驗屋公司陪同</span>
                      </label>
                      <Button className="w-full" onClick={submitBooking} disabled={createBookingMutation.isPending || site.isExpired}>
                        {createBookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        送出預約
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
