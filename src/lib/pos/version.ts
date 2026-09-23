/** Versi kode aplikasi yang sedang dipasang. Naikkan setiap rilis baru. */
export const APP_VERSION = "1.0.0";
export const INSTALLED_VERSION_KEY = "wo-pos-app-version";
export const UPDATE_REQUEST_KEY = "wo-pos-update-request";

export function installedVersion(): string {
  if (typeof localStorage === "undefined") return APP_VERSION;
  return localStorage.getItem(INSTALLED_VERSION_KEY) || APP_VERSION;
}
