type AdminInvalidateUtils = {
  adminAuth: {
    me: {
      invalidate: () => Promise<unknown> | unknown;
    };
  };
  admin: {
    dashboard: {
      invalidate: () => Promise<unknown> | unknown;
    };
    searchBookings: {
      invalidate: () => Promise<unknown> | unknown;
    };
  };
};

export async function redirectToAdminDashboardAfterLogin(utils: AdminInvalidateUtils) {
  await Promise.all([
    utils.adminAuth.me.invalidate(),
    utils.admin.dashboard.invalidate(),
    utils.admin.searchBookings.invalidate(),
  ]);
  window.location.assign("/admin");
}
