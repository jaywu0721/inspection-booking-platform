export type DashboardProjectSource = {
  id: number;
  slug: string;
  name: string;
  companyId: number;
};

export type DashboardCompanySource = {
  id: number;
  slug: string;
  name: string;
};

export type DashboardResidentSource = {
  projectId: number;
};

export function filterResidentsByProject<T extends DashboardResidentSource>(residents: T[], projectId: string) {
  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return residents;
  }

  return residents.filter(resident => resident.projectId === parsedProjectId);
}

export function buildBookingLinkUrl(input: {
  origin: string;
  companySlug: string;
  projectSlug: string;
  type: "initial" | "reinspect";
}) {
  const url = new URL("/", input.origin);
  url.searchParams.set("company", input.companySlug);
  url.searchParams.set("project", input.projectSlug);
  url.searchParams.set("type", input.type);
  return url.toString();
}

export function buildBookingLinkUrlMap(input: {
  origin: string;
  companies: DashboardCompanySource[];
  projects: DashboardProjectSource[];
  links: Array<{ id: number; companyId: number; projectId: number; type: "initial" | "reinspect" }>;
}) {
  const companyById = new Map(input.companies.map(company => [company.id, company]));
  const projectById = new Map(input.projects.map(project => [project.id, project]));

  return new Map(
    input.links.map(link => {
      const company = companyById.get(link.companyId);
      const project = projectById.get(link.projectId);
      if (!company || !project) {
        return [link.id, null] as const;
      }

      return [
        link.id,
        buildBookingLinkUrl({
          origin: input.origin,
          companySlug: company.slug,
          projectSlug: project.slug,
          type: link.type,
        }),
      ] as const;
    })
  );
}
