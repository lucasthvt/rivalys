"""Règles d'URL du crawl : pures, sans réseau, testables.

Miroir Python de src/lib/compare/url-safety.ts. Les deux doivent rester alignés : une URL refusée
côté TypeScript doit l'être ici, et réciproquement.
"""

from __future__ import annotations

import ipaddress
from urllib.parse import urldefrag, urljoin, urlsplit

MAX_PAGES_HARD_CAP = 20
SKIP_EXTENSIONS = (
    ".pdf", ".zip", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp4",
    ".mp3", ".css", ".js", ".json", ".xml", ".ico", ".woff", ".woff2",
)
BLOCKED_STATUSES = frozenset({401, 403, 407, 429, 503})
CAPTCHA_MARKERS = ("captcha", "cf-challenge", "are you a robot", "verify you are human")


class UnsafeUrl(ValueError):
    pass


def assert_public_http_url(url: str) -> None:
    """Lève UnsafeUrl si l'URL n'est pas une adresse publique http(s)."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https"):
        raise UnsafeUrl(f"protocole refusé : {parts.scheme or '(vide)'}")
    host = (parts.hostname or "").lower()
    if not host:
        raise UnsafeUrl("hôte absent")
    if host == "localhost" or host.endswith(".localhost"):
        raise UnsafeUrl(f"hôte refusé : {host}")
    if ":" in host:
        # Littéraux IPv6 refusés en bloc, comme côté TypeScript.
        raise UnsafeUrl(f"adresse IPv6 littérale refusée : {host}")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return  # nom de domaine : vérifié par la résolution côté runtime
    if not ip.is_global:
        raise UnsafeUrl(f"adresse non publique : {host}")


def canonical(url: str) -> str:
    """Retire le fragment et le slash final pour dédoublonner."""
    clean, _ = urldefrag(url)
    parts = urlsplit(clean)
    path = parts.path.rstrip("/") or "/"
    return f"{parts.scheme}://{parts.netloc.lower()}{path}" + (f"?{parts.query}" if parts.query else "")


def same_site(url: str, host: str) -> bool:
    """Même hôte, sous-domaines www inclus."""
    got = (urlsplit(url).hostname or "").lower()
    base = host.lower()
    if base.startswith("www."):
        base = base[4:]
    if got.startswith("www."):
        got = got[4:]
    return got == base or got.endswith("." + base)


def should_follow(href: str, page_url: str, host: str) -> str | None:
    """Renvoie l'URL canonique à suivre, ou None."""
    if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
        return None
    absolute = urljoin(page_url, href)
    try:
        assert_public_http_url(absolute)
    except UnsafeUrl:
        return None
    if not same_site(absolute, host):
        return None
    if urlsplit(absolute).path.lower().endswith(SKIP_EXTENSIONS):
        return None
    return canonical(absolute)


def looks_blocked(status: int, body: str) -> bool:
    if status in BLOCKED_STATUSES:
        return True
    lowered = body[:4000].lower()
    return any(marker in lowered for marker in CAPTCHA_MARKERS)
