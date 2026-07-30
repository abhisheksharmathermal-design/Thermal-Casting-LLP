# Thermal Casting LLP — Enterprise Mobile Platform (PRD v2)

## Overview
Production-ready Android application (Expo/React Native + FastAPI + MongoDB) for **Thermal Casting LLP**. Independent enterprise mobile platform integrated with the existing WordPress corporate website via a pluggable sync adapter. Complete Enterprise Admin CMS enables the business owner to manage all content without developer involvement.

## Theme
Navy blue (`#1E3A5F`) primary matching the TCL corporate logo. Brutalist industrial B2B design system — 0 border-radius, structural borders, gold accent (`#C9A227`) for premium CTAs.

## Modules (Phase 1 + Phase 2)

### Customer-Facing
1. **Corporate Home** — hero, certifications, news feed, featured products, video library, media gallery, brochures/certificates, about section.
2. **Product Catalogue** — 40 seeded products, 10 categories, category chip filter + BY-MATERIAL entry point + search. Detail view w/ specs table, tech data, associated media, sticky RFQ CTA.
3. **Materials & Grades** — dedicated customer-facing browse (grouped by material family: Carbon Steel, Stainless, Nickel Alloy, Duplex, etc.); each material shows all products in that grade.
4. **Enterprise Media Library** — images grid, video full-screen player, brochures/certificates/datasheets.
5. **RFQ Workflow** — multi-item submission (guest + authenticated), auto-generated ref, lifecycle: submitted → under_review → engineering_review → quoted → closed.
6. **Customer Portal** — JWT auth (email/password), personal RFQ dashboard.
7. **AI Knowledge Assistant** — Claude Sonnet 4.5 (Emergent Universal LLM), grounded on company facts + product catalogue + admin-uploaded knowledge docs.

### Enterprise Admin CMS (Phase 2)
Consolidated Admin Console with role-based visibility (12 modules):
- **Products** — full CRUD with extended fields: SKU, subcategory, grade, industry, standards, weight, size, pressure class, temperature rating, casting process, machining/inspection/heat-treatment/manufacturing-capacity details, SEO fields; duplicate; toggle featured/enabled/archived.
- **Materials & Grades** — new module: 16 seeded (WCB, LCC, LCB, WC6, WC9, CF8, CF8M, CF3, CF3M, Duplex, Super Duplex, Monel, Bronze, SG Iron, Cast Iron, Mn Steel Gr.3). Deleting a material cascades a `$pull` from `products.material_ids`.
- **Categories & Subcategories** — hierarchical, display_order + enabled toggle.
- **Company Profile** — editable name, tagline, about, hero image, contact (phone, emails, website, address), certifications, industries.
- **News & Announcements** — publish/unpublish, priority (low/normal/high), types (news/announcement); auto-shown on Home.
- **Customer Management** — search customers, view RFQ count, disable/enable accounts. Role & password_hash immutable via PATCH.
- **RFQ Management** — filter by status, admin assignment, priority (low/normal/high/urgent), quotation URL & amount, internal notes; export CSV.
- **AI Knowledge** — upload document title + content; Claude 4.5 automatically incorporates enabled docs into every reply as approved grounding knowledge.
- **Staff & Roles** (Super Admin only) — create/edit/delete admin & sales executive accounts.
- **WordPress Sync** — pluggable adapter (WP → App pull + App → WP push).
- **Audit Logs** — every admin action logged with actor email/role, entity, timestamp, metadata.
- **Bulk Import / Export** — CSV import for products (name+category required), CSV export for products & RFQs.

## RBAC Matrix
| Action | Super Admin | Admin | Sales Executive | Customer |
|---|:---:|:---:|:---:|:---:|
| View catalogue / media / news | ✅ | ✅ | ✅ | ✅ |
| Submit RFQ / Inquiry | ✅ | ✅ | ✅ | ✅ |
| View own RFQs | — | — | — | ✅ |
| View all RFQs / customers | ✅ | ✅ | ✅ | ❌ |
| Update RFQ / assign / quote | ✅ | ✅ | ✅ | ❌ |
| Product / Material / Category CRUD | ✅ | ✅ | ❌ | ❌ |
| Company / News / AI-Docs / WP Sync | ✅ | ✅ | ❌ | ❌ |
| Audit Logs | ✅ | ✅ | ❌ | ❌ |
| Staff Management | ✅ | ❌ | ❌ | ❌ |

## Test Credentials
- Super Admin: `superadmin@thermalcasting.com` / `SuperAdmin@123`
- Admin: `admin@thermalcasting.com` / `Admin@123`
- Sales Exec: `sales@thermalcasting.com` / `Sales@123`
- Customer: `customer@example.com` / `Customer@123`

## Testing
- **91/91 backend tests passed** (26 Phase 1 + 65 Phase 2). Full CRUD, RBAC, escalation-prevention, audit logging, CSV bulk import, AI grounding refresh.

## WordPress Sync Setup
Add to `/app/backend/.env` to activate:
```
WORDPRESS_BASE_URL=https://your-wp-site.com
WORDPRESS_USER=admin
WORDPRESS_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

## Deferred (Phase 3 — needs user input / credentials)
- **Push Notifications** — requires Firebase `google-services.json` from Firebase Console → Project Settings; only works on published production builds (not Expo Go).
- **File Upload API** — currently URL-based (drag-drop UX requires S3/Cloudinary integration key from user).
- **True two-way WP sync (webhooks)** — currently pull + push on-demand; realtime requires WP webhook setup on the customer's WordPress installation.
