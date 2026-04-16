export type CompanyFormValues = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  contactPhone: string;
  heroTitle: string;
  heroDescription: string;
  inspectionFlow: string;
  handoverFlow: string;
  precautions: string;
  faqText: string;
  contactWindow: string;
};

export type EditableCompany = {
  id: number;
  slug: string;
  name: string;
  logoUrl: string;
  contactPhone: string;
  heroTitle: string;
  heroDescription: string;
  inspectionFlow: string;
  handoverFlow: string;
  precautions: string;
  faqItems: Array<{ question: string; answer: string }>;
  contactWindow: string;
};

export function createEmptyCompanyForm(): CompanyFormValues {
  return {
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
  };
}

export function buildCompanyFormFromRecord(company: EditableCompany): CompanyFormValues {
  return {
    id: String(company.id),
    slug: company.slug,
    name: company.name,
    logoUrl: company.logoUrl,
    contactPhone: company.contactPhone,
    heroTitle: company.heroTitle,
    heroDescription: company.heroDescription,
    inspectionFlow: company.inspectionFlow,
    handoverFlow: company.handoverFlow,
    precautions: company.precautions,
    faqText: company.faqItems.map(item => `${item.question} | ${item.answer}`).join("\n"),
    contactWindow: company.contactWindow,
  };
}
