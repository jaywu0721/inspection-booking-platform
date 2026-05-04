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
  unitNumber: string;
};

export type DashboardBookingSource = {
  projectId: number;
  unitNumberSnapshot: string;
  status?: string | null;
};

export function filterResidentsByProject<T extends DashboardResidentSource>(residents: T[], projectId: string) {
  const parsedProjectId = Number(projectId);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return residents;
  }

  return residents.filter(resident => resident.projectId === parsedProjectId);
}

function normalizeUnitNumber(unitNumber: string) {
  return unitNumber.trim().toUpperCase();
}

export function findUnbookedResidentsForProject<
  TResident extends DashboardResidentSource,
  TBooking extends DashboardBookingSource,
>(input: {
  residents: TResident[];
  bookings: TBooking[];
  projectId: string;
}) {
  const parsedProjectId = Number(input.projectId);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    return [] as TResident[];
  }

  const bookedUnitNumbers = new Set(
    input.bookings
      .filter(booking => booking.projectId === parsedProjectId && booking.status !== "cancelled")
      .map(booking => normalizeUnitNumber(booking.unitNumberSnapshot))
  );

  const uniqueResidentsByUnitNumber = new Map<string, TResident>();

  for (const resident of input.residents) {
    if (resident.projectId !== parsedProjectId) {
      continue;
    }

    const normalizedUnitNumber = normalizeUnitNumber(resident.unitNumber);
    if (bookedUnitNumbers.has(normalizedUnitNumber) || uniqueResidentsByUnitNumber.has(normalizedUnitNumber)) {
      continue;
    }

    uniqueResidentsByUnitNumber.set(normalizedUnitNumber, resident);
  }

  return Array.from(uniqueResidentsByUnitNumber.values());
}

export function buildBookingLinkUrl(input: {
  origin: string;
  shareToken: string;
}) {
  const url = new URL("/", input.origin);
  url.searchParams.set("link", input.shareToken);
  return url.toString();
}

export function buildBookingLinkUrlMap(input: {
  origin: string;
  companies: DashboardCompanySource[];
  projects: DashboardProjectSource[];
  links: Array<{ id: number; companyId: number; projectId: number; shareToken?: string | null }>;
}) {
  const companyById = new Map(input.companies.map(company => [company.id, company]));
  const projectById = new Map(input.projects.map(project => [project.id, project]));

  return new Map(
    input.links.map(link => {
      const company = companyById.get(link.companyId);
      const project = projectById.get(link.projectId);
      if (!company || !project || !link.shareToken) {
        return [link.id, null] as const;
      }

      return [
        link.id,
        buildBookingLinkUrl({
          origin: input.origin,
          shareToken: link.shareToken,
        }),
      ] as const;
    })
  );
}
