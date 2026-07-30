"""
WordPress Integration Adapter — Pluggable CMS Sync

Design principle: The mobile app communicates ONLY with our canonical
FastAPI endpoints. WordPress is a REPLACEABLE upstream — swap this adapter
for another CMS (Contentful, Strapi, custom) without touching the app.

Sync mapping:
- WP posts (category "products")     → db.products
- WP media library (images/videos)   → db.media
- WP posts (category "news")         → db.news
- WP pages (announcements)           → db.announcements

Direction:
- WP → App:   pull_all() — fetch and upsert on-demand or scheduled
- App → WP:   push_product() / push_media() — outbound sync via WP REST API
              (requires WP Application Password credentials)
"""
from __future__ import annotations
import os, base64, logging, uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import httpx

logger = logging.getLogger("wp_adapter")

WP_BASE_URL = os.environ.get("WORDPRESS_BASE_URL", "").rstrip("/")
WP_USER = os.environ.get("WORDPRESS_USER", "")
WP_APP_PASSWORD = os.environ.get("WORDPRESS_APP_PASSWORD", "")


def is_configured() -> bool:
    return bool(WP_BASE_URL)


def _auth_header() -> Dict[str, str]:
    if WP_USER and WP_APP_PASSWORD:
        token = base64.b64encode(f"{WP_USER}:{WP_APP_PASSWORD}".encode()).decode()
        return {"Authorization": f"Basic {token}"}
    return {}


async def _get(client: httpx.AsyncClient, path: str, params: Dict[str, Any] | None = None) -> List[Dict]:
    url = f"{WP_BASE_URL}/wp-json/wp/v2{path}"
    r = await client.get(url, params=params or {}, headers=_auth_header(), timeout=30.0)
    r.raise_for_status()
    data = r.json()
    return data if isinstance(data, list) else [data]


async def fetch_wp_products() -> List[Dict]:
    """Fetch posts tagged 'product' or a custom post type from WordPress."""
    if not is_configured():
        return []
    async with httpx.AsyncClient() as c:
        # Try custom post type first, fall back to posts with category
        try:
            return await _get(c, "/product", {"per_page": 100, "_embed": "true"})
        except Exception:
            return await _get(c, "/posts", {"per_page": 100, "_embed": "true", "categories_exclude": ""})


async def fetch_wp_media() -> List[Dict]:
    if not is_configured():
        return []
    async with httpx.AsyncClient() as c:
        return await _get(c, "/media", {"per_page": 100})


def _strip_html(s: Optional[str]) -> str:
    if not s:
        return ""
    import re
    return re.sub(r"<[^>]+>", "", s).strip()


def map_wp_product(wp: Dict) -> Dict:
    """Normalize a WP post/CPT into our canonical Product schema."""
    embedded = wp.get("_embedded", {})
    featured = None
    if embedded.get("wp:featuredmedia"):
        featured = embedded["wp:featuredmedia"][0].get("source_url")
    title = wp.get("title", {})
    if isinstance(title, dict):
        title = title.get("rendered", "")
    content = wp.get("content", {})
    if isinstance(content, dict):
        content = content.get("rendered", "")
    # attempt to get category from _embedded taxonomies
    category = "General Engineering"
    if embedded.get("wp:term"):
        for taxo in embedded["wp:term"]:
            for term in taxo:
                if term.get("taxonomy") in ("category", "product_cat"):
                    category = term.get("name") or category
                    break
    acf = wp.get("acf") or {}
    return {
        "wp_id": wp.get("id"),
        "wp_link": wp.get("link"),
        "wp_modified": wp.get("modified_gmt"),
        "name": _strip_html(title) or f"WP Product {wp.get('id')}",
        "category": category,
        "description": _strip_html(content)[:2000],
        "materials": acf.get("materials"),
        "applications": acf.get("applications"),
        "standards": acf.get("standards"),
        "specs": acf.get("specs") if isinstance(acf.get("specs"), dict) else None,
        "image_url": featured,
    }


def map_wp_media(wp: Dict) -> Dict:
    mime = (wp.get("mime_type") or "").lower()
    media_type = "image"
    if mime.startswith("video/"):
        media_type = "video"
    elif "pdf" in mime:
        media_type = "pdf"
    title = wp.get("title", {})
    if isinstance(title, dict):
        title = title.get("rendered", "")
    return {
        "wp_id": wp.get("id"),
        "title": _strip_html(title) or f"Media {wp.get('id')}",
        "description": _strip_html((wp.get("description") or {}).get("rendered") if isinstance(wp.get("description"), dict) else wp.get("description")),
        "media_type": media_type,
        "category": "WordPress",
        "url": wp.get("source_url"),
        "thumbnail_url": (wp.get("media_details", {}).get("sizes", {}).get("medium", {}) or {}).get("source_url") or wp.get("source_url"),
    }


async def push_product_to_wp(product: Dict) -> Optional[Dict]:
    """Push a locally-authored product back to WP as a post."""
    if not is_configured() or not (WP_USER and WP_APP_PASSWORD):
        return None
    async with httpx.AsyncClient() as c:
        payload = {
            "title": product["name"],
            "content": product.get("description") or "",
            "status": "publish",
            "meta": {
                "materials": product.get("materials"),
                "applications": product.get("applications"),
                "standards": product.get("standards"),
            },
        }
        endpoint = f"{WP_BASE_URL}/wp-json/wp/v2/product"
        r = await c.post(endpoint, json=payload, headers={**_auth_header(), "Content-Type": "application/json"}, timeout=30.0)
        if r.status_code == 404:
            # fallback to regular posts
            r = await c.post(f"{WP_BASE_URL}/wp-json/wp/v2/posts", json=payload, headers={**_auth_header(), "Content-Type": "application/json"}, timeout=30.0)
        if r.status_code >= 300:
            logger.warning("WP push failed: %s %s", r.status_code, r.text[:200])
            return None
        return r.json()


async def sync_pull_all(db) -> Dict[str, int]:
    """Pull products + media from WordPress and upsert into local DB.
    Idempotent via wp_id."""
    if not is_configured():
        return {"products": 0, "media": 0, "error": "WordPress not configured"}

    now = datetime.now(timezone.utc)
    log_id = str(uuid.uuid4())
    await db.wp_sync_log.insert_one({"id": log_id, "started_at": now, "status": "running", "direction": "pull"})

    counts = {"products": 0, "media": 0}
    try:
        wp_products = await fetch_wp_products()
        for wp in wp_products:
            mapped = map_wp_product(wp)
            existing = await db.products.find_one({"wp_id": mapped["wp_id"]})
            if existing:
                await db.products.update_one({"id": existing["id"]}, {"$set": {**mapped, "updated_at": now}})
            else:
                new_id = str(uuid.uuid4())
                ref = f"WP-{mapped['wp_id']}"
                await db.products.insert_one({
                    "id": new_id, "ref_no": ref, "featured": False,
                    "created_at": now, **mapped,
                })
            counts["products"] += 1

        wp_media = await fetch_wp_media()
        for wm in wp_media:
            mapped = map_wp_media(wm)
            existing = await db.media.find_one({"wp_id": mapped["wp_id"]})
            if existing:
                await db.media.update_one({"id": existing["id"]}, {"$set": {**mapped, "updated_at": now}})
            else:
                await db.media.insert_one({
                    "id": str(uuid.uuid4()), "tags": [], "featured": False,
                    "created_at": now, **mapped,
                })
            counts["media"] += 1

        await db.wp_sync_log.update_one({"id": log_id}, {"$set": {"finished_at": datetime.now(timezone.utc), "status": "success", "counts": counts}})
    except Exception as e:
        logger.exception("WP sync error")
        await db.wp_sync_log.update_one({"id": log_id}, {"$set": {"finished_at": datetime.now(timezone.utc), "status": "error", "error": str(e), "counts": counts}})
        counts["error"] = str(e)
    return counts
