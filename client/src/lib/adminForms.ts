export type ProjectOptionSource = {
  id: number;
  name: string;
  companyId: number;
};

export type ResidentFormDraft = {
  id?: number;
  companyId: string;
  projectId: string;
  unitNumber: string;
  phoneNumber: string;
  name: string;
};

export function parsePositiveId(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function getProjectsForCompany<T extends ProjectOptionSource>(projects: T[], companyId: string) {
  const parsedCompanyId = parsePositiveId(companyId);
  if (!parsedCompanyId) {
    return [] as T[];
  }

  return projects.filter(project => project.companyId === parsedCompanyId);
}

export function validateResidentForm(form: ResidentFormDraft, projects: ProjectOptionSource[]) {
  const parsedCompanyId = parsePositiveId(form.companyId);
  if (!parsedCompanyId) {
    return "請先選擇公司，再儲存住戶資料";
  }

  const parsedProjectId = parsePositiveId(form.projectId);
  if (!parsedProjectId) {
    return "請先選擇建案，再儲存住戶資料";
  }

  const project = projects.find(item => item.id === parsedProjectId);
  if (!project || project.companyId !== parsedCompanyId) {
    return "所選建案不屬於目前公司，請重新選擇";
  }

  if (!form.unitNumber.trim()) {
    return "請先輸入住戶標準戶號";
  }

  if (!form.phoneNumber.trim() && !form.name.trim()) {
    return "手機號碼與姓名至少需填寫一項";
  }

  return null;
}
