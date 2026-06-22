import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDateInTaipei, formatDateTimeInTaipei, getDateKeyInTaipei } from "@/lib/dateHelpers";
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

const formatDate = formatDateInTaipei;
const formatDateTime = formatDateTimeInTaipei;
const getDateKey = getDateKeyInTaipei;
const HANDOVER_FLOW_IMAGE_PATH = "/manus-storage/customer-handover-flow_6324d5db.webp";

function parseBookingErrorMessage(message: string) {
  try {
    const parsed = JSON.parse(message);
    if (Array.isArray(parsed)) {
      const emailIssue = parsed.find(issue => issue?.path?.[0] === "gmail");
      if (emailIssue?.message) {
        return emailIssue.message;
      }
    }
  } catch {
    return message;
  }

  return message;
}

export default function Home() {
  const pageRequest = useMemo(() => {
    const search = new URLSearchParams(window.location.search);
    const linkToken = search.get("link") || undefined;
    const companySlug = search.get("company") || undefined;
    const projectSlug = search.get("project") || undefined;
    const type = (search.get("type") === "reinspect" ? "reinspect" : "initial") as "initial" | "reinspect";

    if (linkToken) {
      return {
        hasBookingTarget: true,
        params: { linkToken },
      };
    }

    if (companySlug && projectSlug) {
      return {
        hasBookingTarget: true,
        params: { companySlug, projectSlug, type },
      };
    }

    return {
      hasBookingTarget: false,
      params: { companySlug: "", projectSlug: "", type },
    };
  }, []);
  const params = pageRequest.params;
  const hasBookingTarget = pageRequest.hasBookingTarget;

  const [unitNumber, setUnitNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [gmail, setGmail] = useState("");
  const [slotId, setSlotId] = useState<number | null>(null);
  const [selectedSlotDate, setSelectedSlotDate] = useState("");
  const [hasInspectionCompany, setHasInspectionCompany] = useState(false);
  const [isRescheduleMode, setIsRescheduleMode] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const bookingSectionRef = useRef<HTMLDivElement | null>(null);
  const slotSelectionSectionRef = useRef<HTMLDivElement | null>(null);

  const siteQuery = trpc.publicSite.getContext.useQuery(params, {
    refetchOnWindowFocus: false,
    enabled: hasBookingTarget,
  });

  const verifyMutation = trpc.publicSite.verifyResident.useMutation({
    onSuccess: result => {
      setVerificationResult(result);
      setSelectedSlotDate("");
      setSlotId(null);
      setIsRescheduleMode(false);
      void siteQuery.refetch?.();
      toast.success("驗證成功，已載入既有預約與可用時段");
      if (typeof window !== "undefined" && window.innerWidth < 1024) {
        window.requestAnimationFrame(() => {
          bookingSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    onError: error => {
      setVerificationResult(null);
      setIsRescheduleMode(false);
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
      setSelectedSlotDate("");
    },
    onError: error => {
      toast.error(parseBookingErrorMessage(error.message));
    },
  });

  const rescheduleBookingMutation = trpc.publicSite.rescheduleBooking.useMutation({
    onSuccess: async () => {
      toast.success("預約日期已更新");
      if (!verificationResult?.resident) return;
      const refreshed = await verifyMutation.mutateAsync({
        ...params,
        unitNumber,
        phoneNumber,
      });
      setVerificationResult(refreshed);
      setSlotId(null);
      setSelectedSlotDate("");
      setIsRescheduleMode(false);
    },
    onError: error => {
      toast.error(error.message);
    },
  });

  const site = siteQuery.data;
  const availableSlots: any[] = site?.availableSlots ?? verificationResult?.site.availableSlots ?? [];
  const availableDates: Array<{ key: string; label: string; count: number }> = Array.from(
    availableSlots.reduce((map, slot) => {
      const key = getDateKey(slot.slotDate);
      const current = map.get(key);
      if (current) {
        current.count += 1;
        return map;
      }
      map.set(key, { key, label: formatDate(slot.slotDate), count: 1 });
      return map;
    }, new Map<string, { key: string; label: string; count: number }>()).values()
  );
  const visibleSlots = selectedSlotDate
    ? availableSlots.filter(slot => getDateKey(slot.slotDate) === selectedSlotDate)
    : [];
  const sameLinkExistingBooking = verificationResult?.existingBookings?.find((booking: any) => booking.linkId === site?.link.id) ?? null;

  useEffect(() => {
    if (slotId && !visibleSlots.some(slot => slot.id === slotId)) {
      setSlotId(null);
    }
  }, [slotId, visibleSlots]);

  const scrollToSlotSelectionStep = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        slotSelectionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  };

  const handleDateSelection = (dateKey: string) => {
    setSelectedSlotDate(dateKey);
    setSlotId(null);
    void siteQuery.refetch?.();
    scrollToSlotSelectionStep();
  };

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
    if (!selectedSlotDate) {
      toast.error("請先選擇預約日期");
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
      gmail: gmail.trim(),
      hasInspectionCompany,
    });
  };

  const submitReschedule = async () => {
    if (!verificationResult?.resident) {
      toast.error("請先完成住戶驗證");
      return;
    }

    if (!sameLinkExistingBooking) {
      toast.error("目前沒有可修改的預約紀錄");
      return;
    }

    if (site?.isExpired) {
      toast.error("此預約連結已截止，請聯絡窗口由管理員協助改期");
      return;
    }

    if (!selectedSlotDate) {
      toast.error("請先選擇新的預約日期");
      return;
    }

    if (!slotId) {
      toast.error("請先選擇新的預約時段");
      return;
    }

    if (slotId === sameLinkExistingBooking.slotId) {
      toast.error("您目前已預約此時段");
      return;
    }

    await rescheduleBookingMutation.mutateAsync({
      ...params,
      bookingId: sameLinkExistingBooking.id,
      residentId: verificationResult.resident.id,
      currentSlotId: sameLinkExistingBooking.slotId,
      newSlotId: slotId,
      hasInspectionCompany,
    });
  };

  if (!hasBookingTarget) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>目前尚未建立可公開預約的建案頁面</CardTitle>
            <CardDescription>
              這不是住戶操作錯誤。你先前要求把後台測試資料清空後，首頁如果沒有帶完整預約連結，就不應再硬查不存在的示範建案。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>目前尚未開放住戶預約。請向建設公司或通知窗口索取正式預約連結後，再重新開啟前台頁面。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              這個連結格式有問題。你有沒有想過，如果分享網址缺少完整 token，或 company、project、type 組合不一致，住戶根本進不來。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>請直接使用後台產生的完整分享網址，例如：<code>?link=你的專屬連結 token</code>。如果分享網址缺少完整 token，或使用了過期、停用、錯誤的參數組合，住戶端就會打不開。</p>
            <p>這個頁面不再提供任何示範連結，避免正式站點重新導向到系統測試內容。</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company = site.company;
  const project = site.project;
  const linkStartsAt = site.link.startsAt ? new Date(site.link.startsAt) : null;
  const linkEndsAt = site.link.endsAt ? new Date(site.link.endsAt) : null;
  const msUntilLinkEnds = linkEndsAt ? linkEndsAt.getTime() - Date.now() : null;
  const isClosingSoon = typeof msUntilLinkEnds === "number" && msUntilLinkEnds > 0 && msUntilLinkEnds <= 1000 * 60 * 60 * 24;
  const displayedPrecautions = company.precautions.replace(
    "改期限制： 為確保每位住戶的權益與工班排程，本系統不開放自行改期，請見諒。",
    "改期限制：連結開放時間內可自行改期；若該案未開放改期作業或連結已截止，請自行聯絡公司。"
  );

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f4f1ea_0%,#ffffff_38%,#f8f7f4_100%)] text-foreground">
      <section className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(140,109,85,0.16),transparent_38%),linear-gradient(135deg,#15303a_0%,#294550_38%,#8d6c53_100%)] text-white">
        <div className="container py-12 md:py-16">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="bg-white/12 text-white border-white/20 hover:bg-white/12">{site.link.type === "initial" ? "初驗預約" : "複驗預約"}</Badge>
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
                <div className="space-y-3">
                  <p className="max-w-2xl text-base leading-7 text-white/82 md:text-lg">{company.heroDescription}</p>
                </div>
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
              <div className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-sm font-medium text-white/88">預約連結開放時間</p>
                  <Badge className={site.isExpired ? "border-destructive/40 bg-destructive/15 text-white hover:bg-destructive/15" : isClosingSoon ? "border-amber-200/40 bg-amber-200/15 text-white hover:bg-amber-200/15" : "border-emerald-200/40 bg-emerald-200/15 text-white hover:bg-emerald-200/15"}>
                    {site.isExpired ? "已截止" : isClosingSoon ? "即將截止" : "開放中"}
                  </Badge>
                </div>
                <p className="mt-3 text-base font-medium text-white">
                  {linkStartsAt && linkEndsAt ? `${formatDateTime(linkStartsAt)} ～ ${formatDateTime(linkEndsAt)}` : "目前尚未提供完整開放時間資訊，請以建案通知為準。"}
                </p>
                <p className="mt-2 text-sm leading-6 text-white/72">
                  {site.isExpired
                    ? "這個預約連結已超過開放時間。你仍可完成住戶驗證查看既有預約，但若要新預約或改期，請直接聯絡公司窗口。"
                    : isClosingSoon
                      ? "此連結即將結束預約。若你尚未完成預約或需要改期，請盡快在開放時間內處理。"
                      : "請在以上開放時間內完成預約或改期；超過截止時間後，系統將停止住戶自行操作。"}
                </p>
              </div>
            </div>
            <Card className="border-white/15 bg-white/92 text-card-foreground shadow-2xl">
              <CardHeader>
                <CardTitle>快速進入預約驗證</CardTitle>
                <CardDescription>系統會先檢查戶號與任一已登記手機，再開放查看既有預約與可選時段。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="unitNumber">標準戶號</Label>
                  <Input id="unitNumber" value={unitNumber} onChange={event => setUnitNumber(event.target.value)} placeholder={project.houseNumberExample} />
                  <p className="text-xs text-muted-foreground">格式提示：{project.unitFormatHint}。範例：{project.houseNumberExample}</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">手機號碼</Label>
                  <Input id="phoneNumber" value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} placeholder="請輸入該戶任一已登記手機號碼" />
                  <p className="text-xs text-muted-foreground">若同一戶別登記了多位聯絡人，只要輸入其中任一支已登記手機即可通過驗證。</p>
                </div>
                <Button className="w-full" onClick={submitVerification} disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  進行住戶驗證
                </Button>
                {site.isExpired ? (
                  <Alert className="border-destructive/30 bg-destructive/5">
                    <CircleAlert className="h-4 w-4" />
                    <AlertTitle>連結已截止</AlertTitle>
                    <AlertDescription>
                      這個初驗／複驗連結目前未啟用或已超過可預約期間。
                      {linkEndsAt ? ` 截止時間為 ${formatDateTime(linkEndsAt)}。` : " "}
                      請聯絡建案窗口處理。
                    </AlertDescription>
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
                <p className="whitespace-pre-line leading-7 text-muted-foreground">{displayedPrecautions}</p>
              </CardContent>
            </Card>

            <Card className="border-border/70 shadow-sm">
              <CardHeader>
                <CardTitle>常見問答</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <Accordion type="single" collapsible className="w-full">
                  {company.faqItems.map((item, index) => {
                    const answer = item.question === "如果要改期怎麼處理？"
                      ? "連結開放時間內均可自行改期；若該連結未開放改期或已截止，請自行聯絡公司窗口協助處理。"
                      : item.answer;

                    return (
                      <AccordionItem key={`${item.question}-${index}`} value={`faq-${index}`}>
                        <AccordionTrigger>{item.question}</AccordionTrigger>
                        <AccordionContent className="leading-7 text-muted-foreground">{answer}</AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
                <Separator />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold text-foreground">詳細交屋流程圖</h3>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border/70 bg-muted/20 p-3">
                    <img
                      src={HANDOVER_FLOW_IMAGE_PATH}
                      alt="詳細交屋流程圖"
                      className="mx-auto w-full max-w-[420px] object-contain"
                      loading="lazy"
                    />
                  </div>
                </div>
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
            <Card ref={bookingSectionRef} className="border-border/70 shadow-lg">
              <CardHeader>
                <CardTitle>預約查詢與送出</CardTitle>
                <CardDescription>驗證成功後，這一區會先顯示可預約日期，再由你進一步選擇該日期可用時段。</CardDescription>
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
                        <h3 className="font-semibold">{sameLinkExistingBooking ? "修改既有預約" : "選擇新的預約時段"}</h3>
                        {site.isExpired && !sameLinkExistingBooking ? (
                          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">此預約連結已截止。你仍可完成住戶驗證查看既有預約紀錄，但目前不能再選擇新的日期或時段；若現在才要預約，請直接聯絡頁面上的窗口。</div>
                        ) : sameLinkExistingBooking ? (
                          <>
                            <Alert className="border-amber-300/60 bg-amber-50 text-amber-950">
                              <CircleAlert className="h-4 w-4" />
                              <AlertTitle>你已完成預約</AlertTitle>
                              <AlertDescription className="space-y-3">
                                <p>
                                  目前預約時間：{formatDate(sameLinkExistingBooking.slotDate)} {sameLinkExistingBooking.startLabel} - {sameLinkExistingBooking.endLabel}
                                </p>
                                <p>
                                  這裡允許你在連結開放期間內修改日期時段，也可同步更新此次是否由驗屋公司陪同；若連結截止，仍需改由管理員在後台協助改期。
                                </p>
                              </AlertDescription>
                            </Alert>

                            {site.isExpired ? (
                              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">這個預約連結目前未啟用或已超過可操作期間，客戶端不能再自行改期，請直接聯絡頁面上的窗口。</div>
                            ) : !isRescheduleMode ? (
                              <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                  setIsRescheduleMode(true);
                                  setSelectedSlotDate("");
                                  setSlotId(null);
                                  setHasInspectionCompany(Boolean(sameLinkExistingBooking?.hasInspectionCompany));
                                  void siteQuery.refetch?.();
                                }}
                              >
                                修改日期
                              </Button>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 p-4">
                                  <div>
                                    <p className="font-medium">請重新選擇日期與時段</p>
                                    <p className="text-sm text-muted-foreground">先送出者取得名額。若資料已被更新，你會收到重新整理提示。</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={() => {
                                      setIsRescheduleMode(false);
                                      setSelectedSlotDate("");
                                      setSlotId(null);
                                    }}
                                  >
                                    取消
                                  </Button>
                                </div>
                                <div className="space-y-4">
                                  {availableSlots.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">目前沒有可改期的時段。這通常代表連結下暫時沒有仍開放、未過期且有餘額的時段。</div>
                                  ) : (
                                    <>
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                          <h4 className="font-medium">第一步：先選擇新的日期</h4>
                                          <Badge variant="secondary">{availableDates.length} 天</Badge>
                                        </div>
                                        <div className="space-y-3">
                                          {availableDates.map(dateOption => {
                                            const isSelectedDate = selectedSlotDate === dateOption.key;
                                            return (
                                              <button
                                                key={dateOption.key}
                                                type="button"
                                                onClick={() => {
                                                  handleDateSelection(dateOption.key);
                                                }}
                                                className={`w-full rounded-2xl border p-4 text-left transition ${isSelectedDate ? "border-primary bg-primary/5 shadow-sm" : "border-border/80 hover:border-primary/40"}`}
                                              >
                                                <div className="flex items-center justify-between gap-3">
                                                  <div>
                                                    <p className="font-medium">{dateOption.label}</p>
                                                    <p className="text-sm text-muted-foreground">點選後顯示該日期仍可改期的時段</p>
                                                  </div>
                                                  <Badge variant={isSelectedDate ? "default" : "secondary"}>{dateOption.count} 個時段</Badge>
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                      <div ref={slotSelectionSectionRef} className="space-y-3">
                                        <div className="flex items-center justify-between gap-3">
                                          <h4 className="font-medium">第二步：選擇新的時間</h4>
                                          {selectedSlotDate ? <Badge variant="outline">{formatDate(selectedSlotDate)}</Badge> : null}
                                        </div>
                                        {!selectedSlotDate ? (
                                          <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">請先選擇日期，再查看該日期可改期時間。</div>
                                        ) : (
                                          <div className="space-y-3">
                                            {visibleSlots.map((slot: any) => {
                                              const isFull = slot.remaining <= 0;
                                              const isCurrentSlot = slot.id === sameLinkExistingBooking.slotId;
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
                                                      <p className="font-medium">{slot.startLabel} - {slot.endLabel}</p>
                                                      <p className="text-sm text-muted-foreground">可改期名額以你送出當下的實際剩餘為準。{isCurrentSlot ? " 目前已預約此時段，不能原時段送出。" : ""}</p>
                                                    </div>
                                                    <Badge variant={isFull ? "destructive" : isCurrentSlot ? "outline" : "secondary"}>
                                                      {isFull ? "已額滿" : isCurrentSlot ? "目前時段" : `剩餘 ${slot.remaining} 名`}
                                                    </Badge>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                                <label className="flex items-center gap-3 rounded-2xl border border-border/70 p-4">
                                  <Checkbox checked={hasInspectionCompany} onCheckedChange={checked => setHasInspectionCompany(Boolean(checked))} />
                                  <span className="text-sm text-muted-foreground">此次驗屋是否會由驗屋公司陪同</span>
                                </label>
                                <Button className="w-full" onClick={submitReschedule} disabled={rescheduleBookingMutation.isPending || site.isExpired}>
                                  {rescheduleBookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  確認修改日期
                                </Button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="space-y-4">
                              {availableSlots.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">目前尚未開放可用時段，請聯絡窗口安排。</div>
                              ) : (
                                <>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <h4 className="font-medium">第一步：先選擇日期</h4>
                                      <Badge variant="secondary">{availableDates.length} 天</Badge>
                                    </div>
                                    <div className="space-y-3">
                                      {availableDates.map(dateOption => {
                                        const isSelectedDate = selectedSlotDate === dateOption.key;
                                        return (
                                          <button
                                            key={dateOption.key}
                                            type="button"
                                            onClick={() => {
                                              handleDateSelection(dateOption.key);
                                            }}
                                            className={`w-full rounded-2xl border p-4 text-left transition ${isSelectedDate ? "border-primary bg-primary/5 shadow-sm" : "border-border/80 hover:border-primary/40"}`}
                                          >
                                            <div className="flex items-center justify-between gap-3">
                                              <div>
                                                <p className="font-medium">{dateOption.label}</p>
                                                <p className="text-sm text-muted-foreground">點選後顯示該日期可預約時段</p>
                                              </div>
                                              <Badge variant={isSelectedDate ? "default" : "secondary"}>{dateOption.count} 個時段</Badge>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div ref={slotSelectionSectionRef} className="space-y-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <h4 className="font-medium">第二步：選擇時間</h4>
                                      {selectedSlotDate ? <Badge variant="outline">{formatDate(selectedSlotDate)}</Badge> : null}
                                    </div>
                                    {!selectedSlotDate ? (
                                      <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">請先選擇日期，再查看該日期可預約時間。</div>
                                    ) : (
                                      <div className="space-y-3">
                                        {visibleSlots.map((slot: any) => {
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
                                                  <p className="font-medium">{slot.startLabel} - {slot.endLabel}</p>
                                                  <p className="text-sm text-muted-foreground">可預約名額以你送出當下的實際剩餘為準。</p>
                                                </div>
                                                <Badge variant={isFull ? "destructive" : "secondary"}>{isFull ? "已額滿" : `剩餘 ${slot.remaining} 名`}</Badge>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="gmail">Email（選填）</Label>
                              <Input id="gmail" type="email" value={gmail} onChange={event => setGmail(event.target.value)} placeholder="name@example.com" />
                            </div>
                            <label className="flex items-center gap-3 rounded-2xl border border-border/70 p-4">
                              <Checkbox checked={hasInspectionCompany} onCheckedChange={checked => setHasInspectionCompany(Boolean(checked))} />
                              <span className="text-sm text-muted-foreground">此次驗屋是否會由驗屋公司陪同</span>
                            </label>
                            <Button className="w-full" onClick={submitBooking} disabled={createBookingMutation.isPending || site.isExpired}>
                              {createBookingMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              送出預約
                            </Button>
                          </>
                        )}
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
