import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API_BASE = `${BASE}/api`;
export const FILE_BASE = BASE;  // /api/files/<name> served here

const TOKEN_KEY = "tc_token_v1";
const USER_KEY = "tc_user_v1";

/** Resolve stored relative paths (/api/files/...) to full URLs so <Image> works */
export function resolveUrl(u?: string | null): string | undefined {
  if (!u) return undefined;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${BASE}${u}`;
  return u;
}

export async function uploadFile(
  uri: string,
  name: string,
  mimeType: string,
  kind = "image",
  opts: { saveToLibrary?: boolean; title?: string; onProgress?: (pct: number) => void } = {},
) {
  const t = await AsyncStorage.getItem(TOKEN_KEY);
  return new Promise<{ id: string; url: string; content_type: string; size: number; media_id?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/admin/upload`);
    if (t) xhr.setRequestHeader("Authorization", `Bearer ${t}`);
    if (xhr.upload && opts.onProgress) {
      xhr.upload.onprogress = (e: any) => {
        if (e.lengthComputable) opts.onProgress!(Math.round((e.loaded / e.total) * 100));
      };
    }
    xhr.onload = () => {
      try {
        const data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error((data && data.detail) || `HTTP ${xhr.status}`));
      } catch (e: any) { reject(e); }
    };
    xhr.onerror = () => reject(new Error("Network error"));
    const form = new FormData();
    form.append("file", { uri, name, type: mimeType } as any);
    form.append("kind", kind);
    if (opts.saveToLibrary) form.append("save_to_library", "true");
    if (opts.title) form.append("title", opts.title);
    xhr.send(form as any);
  });
}

export async function saveAuth(token: string, user: any) {
  await AsyncStorage.setItem(TOKEN_KEY, token);
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}
export async function loadAuth(): Promise<{ token: string | null; user: any | null }> {
  const [t, u] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);
  return { token: t, user: u ? JSON.parse(u) : null };
}
export async function clearAuth() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

async function request<T = any>(
  path: string,
  opts: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false) {
    const t = await AsyncStorage.getItem(TOKEN_KEY);
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = (data && (data.detail || data.message)) || `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

export const api = {
  // auth
  register: (body: any) => request("/auth/register", { method: "POST", body, auth: false }),
  login: (body: any) => request("/auth/login", { method: "POST", body, auth: false }),
  me: () => request("/auth/me"),
  // company
  company: () => request("/company", { auth: false }),
  // products
  products: (params: { category?: string; search?: string; featured?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.category) q.set("category", params.category);
    if (params.search) q.set("search", params.search);
    if (params.featured !== undefined) q.set("featured", String(params.featured));
    return request(`/products${q.toString() ? "?" + q.toString() : ""}`, { auth: false });
  },
  productCategories: () => request("/products/categories", { auth: false }),
  product: (id: string) => request(`/products/${id}`, { auth: false }),
  // media
  media: (params: { media_type?: string; product_id?: string; search?: string } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, String(v)));
    return request(`/media${q.toString() ? "?" + q.toString() : ""}`, { auth: false });
  },
  videos: () => request("/media/videos", { auth: false }),
  // rfq
  submitRFQ: (body: any) => request("/rfq", { method: "POST", body }),
  myRFQs: () => request("/rfq/my"),
  allRFQs: () => request("/rfq/all"),
  rfq: (id: string) => request(`/rfq/${id}`),
  updateRFQ: (id: string, body: any) => request(`/rfq/${id}`, { method: "PATCH", body }),
  // ai
  chat: (body: { session_id: string; message: string }) =>
    request("/ai/chat", { method: "POST", body }),
  chatHistory: (session_id: string) => request(`/ai/history/${session_id}`, { auth: false }),
  // media (admin CRUD + replace)
  adminUpdateMedia: (id: string, body: any) => request(`/admin/media/${id}`, { method: "PATCH", body }),
  adminDeleteMedia: (id: string) => request(`/admin/media/${id}`, { method: "DELETE" }),
  adminCreateMedia: (body: any) => request("/admin/media", { method: "POST", body }),
  adminReplaceMedia: (id: string, body: { url: string; thumbnail_url?: string | null; upload_id?: string | null }) =>
    request(`/admin/media/${id}/replace`, { method: "POST", body }),

  // admin
  adminStats: () => request("/admin/stats"),
  // auth extras (Phase 3)
  changePassword: (body: { current_password: string; new_password: string; confirm_password: string }) =>
    request("/auth/change-password", { method: "POST", body }),
  sessions: () => request("/auth/sessions"),
  revokeSession: (sid: string) => request(`/auth/sessions/${sid}`, { method: "DELETE" }),
  logoutOtherSessions: () => request("/auth/sessions/logout-others", { method: "POST" }),
  serverLogout: () => request("/auth/logout", { method: "POST" }),
  // uploads (multipart handled separately in UploadField)
  // admin - products
  adminCreateProduct: (body: any) => request("/admin/products/full", { method: "POST", body }),
  adminUpdateProduct: (id: string, body: any) => request(`/admin/products/${id}`, { method: "PATCH", body }),
  adminDeleteProduct: (id: string) => request(`/admin/products/${id}`, { method: "DELETE" }),
  adminDuplicateProduct: (id: string) => request(`/admin/products/${id}/duplicate`, { method: "POST" }),
  adminToggleProduct: (id: string, field: string) => request(`/admin/products/${id}/toggle?field=${field}`, { method: "POST" }),
  // materials
  materials: () => request("/materials", { auth: false }),
  material: (id: string) => request(`/materials/${id}`, { auth: false }),
  adminCreateMaterial: (body: any) => request("/admin/materials", { method: "POST", body }),
  adminUpdateMaterial: (id: string, body: any) => request(`/admin/materials/${id}`, { method: "PATCH", body }),
  adminDeleteMaterial: (id: string) => request(`/admin/materials/${id}`, { method: "DELETE" }),
  // categories
  categories: () => request("/categories", { auth: false }),
  adminCreateCategory: (body: any) => request("/admin/categories", { method: "POST", body }),
  adminUpdateCategory: (id: string, body: any) => request(`/admin/categories/${id}`, { method: "PATCH", body }),
  adminDeleteCategory: (id: string) => request(`/admin/categories/${id}`, { method: "DELETE" }),
  // company
  adminUpdateCompany: (body: any) => request("/admin/company", { method: "PATCH", body }),
  // news / announcements
  news: (type?: string) => request(`/news${type ? "?type=" + type : ""}`, { auth: false }),
  adminCreateNews: (body: any) => request("/admin/news", { method: "POST", body }),
  adminUpdateNews: (id: string, body: any) => request(`/admin/news/${id}`, { method: "PATCH", body }),
  adminDeleteNews: (id: string) => request(`/admin/news/${id}`, { method: "DELETE" }),
  // customers
  adminCustomers: (q?: string) => request(`/admin/customers${q ? "?q=" + encodeURIComponent(q) : ""}`),
  adminCustomer: (id: string) => request(`/admin/customers/${id}`),
  adminUpdateCustomer: (id: string, body: any) => request(`/admin/customers/${id}`, { method: "PATCH", body }),
  // staff
  adminStaff: () => request("/admin/staff"),
  adminCreateStaff: (body: any) => request("/admin/staff", { method: "POST", body }),
  adminUpdateStaff: (id: string, body: any) => request(`/admin/staff/${id}`, { method: "PATCH", body }),
  adminDeleteStaff: (id: string) => request(`/admin/staff/${id}`, { method: "DELETE" }),
  // rfq enhanced
  adminUpdateRFQ: (id: string, body: any) => request(`/admin/rfq/${id}`, { method: "PATCH", body }),
  // inquiries
  submitInquiry: (body: any) => request("/inquiry", { method: "POST", body, auth: false }),
  adminInquiries: (status?: string) => request(`/admin/inquiries${status ? "?status=" + status : ""}`),
  adminUpdateInquiry: (id: string, body: any) => request(`/admin/inquiries/${id}`, { method: "PATCH", body }),
  // ai docs
  adminAIDocs: () => request("/admin/ai/docs"),
  adminCreateAIDoc: (body: any) => request("/admin/ai/docs", { method: "POST", body }),
  adminDeleteAIDoc: (id: string) => request(`/admin/ai/docs/${id}`, { method: "DELETE" }),
  // audit
  adminAuditLogs: (entity?: string) => request(`/admin/audit-logs${entity ? "?entity=" + entity : ""}`),
  // bulk
  adminImportCSV: (csv_text: string) => request("/admin/products/import-csv", { method: "POST", body: { csv_text } }),
};
