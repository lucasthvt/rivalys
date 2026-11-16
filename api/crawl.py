"""Fonction Vercel (Python) : crawl borné d'un site concurrent, appelée par fetch-site.ts.

Sécurité :
- authentification par secret partagé (CRAWLER_SECRET), comparé en temps constant ;
- seules les adresses publiques http(s) sont acceptées (garde répétée ici, en plus de TypeScript) ;
- plafond de pages et budget de temps imposés côté serveur, quoi que demande l'appelant.
"""

import hmac
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "python"))

from rivalys_crawler.crawl import crawl_site  # noqa: E402
from rivalys_crawler.url_policy import MAX_PAGES_HARD_CAP, UnsafeUrl, assert_public_http_url  # noqa: E402

MAX_BODY_BYTES = 4096


class handler(BaseHTTPRequestHandler):  # noqa: N801 — nom imposé par le runtime Vercel
    def _reply(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):  # noqa: N802
        secret = os.environ.get("CRAWLER_SECRET", "")
        provided = self.headers.get("x-crawler-secret", "")
        if not secret or not hmac.compare_digest(secret.encode(), provided.encode()):
            return self._reply(404, {"error": "not_found"})

        length = int(self.headers.get("content-length") or 0)
        if length <= 0 or length > MAX_BODY_BYTES:
            return self._reply(400, {"error": "bad_body"})
        try:
            body = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return self._reply(400, {"error": "bad_json"})

        url = body.get("url") if isinstance(body, dict) else None
        max_pages = body.get("maxPages", MAX_PAGES_HARD_CAP) if isinstance(body, dict) else None
        if not isinstance(url, str) or not isinstance(max_pages, int):
            return self._reply(400, {"error": "bad_fields"})
        try:
            assert_public_http_url(url)
        except UnsafeUrl as error:
            return self._reply(422, {"error": "unsafe_url", "detail": str(error)})

        outcome = crawl_site(url, max_pages=max(1, min(max_pages, MAX_PAGES_HARD_CAP)))
        return self._reply(
            200,
            {
                "pages": outcome.pages,
                "haltedReason": outcome.halted_reason,
                "robotsDisallowed": outcome.robots_disallowed,
            },
        )
