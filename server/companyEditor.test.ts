import { describe, expect, it } from "vitest";
import { DEFAULT_SLOT_PRESETS, createProjectSlug } from "../client/src/lib/adminConfig";
import { buildCompanyFormFromRecord, createEmptyCompanyForm } from "../client/src/lib/companyEditor";

describe("company editor helpers", () => {
  it("creates an empty company form with default faq placeholder", () => {
    expect(createEmptyCompanyForm()).toEqual({
      id: "",
      slug: "",
      name: "",
      logoUrl: "",
      contactPhone: "",
      heroTitle: "",
      heroDescription: "",
      inspectionFlow: "",
      handoverFlow: "",
      precautions: "",
      faqText: "預約方式 | 先驗證戶號與手機後再選時段",
      contactWindow: "",
    });
  });

  it("maps an existing company record into editable form values", () => {
    const result = buildCompanyFormFromRecord({
      id: 12,
      slug: "yisin",
      name: "鷁欣建設",
      logoUrl: "https://cdn.example.com/yisin.png",
      contactPhone: "04-0000-0001",
      heroTitle: "鷁欣建設驗屋預約系統",
      heroDescription: "品牌化驗屋入口",
      inspectionFlow: "1. 驗證\n2. 預約",
      handoverFlow: "交屋流程說明",
      precautions: "請準時到場",
      faqItems: [
        { question: "如何預約", answer: "先驗證再選時段" },
        { question: "如何改期", answer: "請聯絡客服" },
      ],
      contactWindow: "客服窗口",
    });

    expect(result).toEqual({
      id: "12",
      slug: "yisin",
      name: "鷁欣建設",
      logoUrl: "https://cdn.example.com/yisin.png",
      contactPhone: "04-0000-0001",
      heroTitle: "鷁欣建設驗屋預約系統",
      heroDescription: "品牌化驗屋入口",
      inspectionFlow: "1. 驗證\n2. 預約",
      handoverFlow: "交屋流程說明",
      precautions: "請準時到場",
      faqText: "如何預約 | 先驗證再選時段\n如何改期 | 請聯絡客服",
      contactWindow: "客服窗口",
    });
  });
});

describe("admin scheduling helpers", () => {
  it("exposes the requested default slot presets", () => {
    expect(DEFAULT_SLOT_PRESETS).toEqual([
      { startLabel: "09:00", endLabel: "10:30" },
      { startLabel: "10:30", endLabel: "12:00" },
      { startLabel: "14:00", endLabel: "15:30" },
      { startLabel: "15:30", endLabel: "17:00" },
    ]);
  });

  it("generates project slug automatically when slug field is hidden from admin", () => {
    expect(createProjectSlug("Demo Project", "7")).toBe("demo-project-7");
    expect(createProjectSlug("   ", "9")).toMatch(/^project-\d+-9$/);
  });
});
