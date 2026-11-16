"""Teste le spider contre un petit serveur local (127.0.0.1, serveur de test uniquement).

La garde d'adresse publique est désactivée ici seulement, parce que le serveur de test écoute sur
la boucle locale. Les règles de production sont couvertes par test_url_policy.py.
"""

import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock

from rivalys_crawler import crawl as crawl_mod
from rivalys_crawler import url_policy

PAGES = {
    "/": '<a href="/pricing">p</a><a href="/about">a</a><a href="https://elsewhere.test/">x</a>',
    "/pricing": '<a href="/">home</a><a href="/faq">faq</a>',
    "/about": '<a href="/team">team</a>',
    "/faq": "faq",
    "/team": "team",
}


class Handler(BaseHTTPRequestHandler):
    blocked_paths: set[str] = set()

    def log_message(self, *args):
        pass

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/robots.txt":
            self._send(404, "text/plain", "")
            return
        if path in self.blocked_paths:
            self._send(403, "text/html", "<html>forbidden</html>")
            return
        if path in PAGES:
            self._send(200, "text/html", f"<html><body>{PAGES[path]}</body></html>")
            return
        self._send(404, "text/html", "<html>nope</html>")

    def _send(self, code, ctype, body):
        data = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


class CrawlTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def setUp(self):
        Handler.blocked_paths = set()
        self._patches = [
            mock.patch.object(crawl_mod, "assert_public_http_url", lambda url: None),
            mock.patch.object(url_policy, "assert_public_http_url", lambda url: None),
            mock.patch.object(crawl_mod.CompetitorSpider, "download_delay", 0.0),
        ]
        for p in self._patches:
            p.start()

    def tearDown(self):
        for p in self._patches:
            p.stop()

    def test_crawls_internal_pages_only_and_respects_cap(self):
        outcome = crawl_mod.crawl_site(f"http://127.0.0.1:{self.port}/", max_pages=3)
        urls = [p["url"] for p in outcome.pages]
        self.assertLessEqual(len(urls), 3)
        self.assertGreaterEqual(len(urls), 2)
        self.assertTrue(urls[0].endswith("/"))
        self.assertTrue(all(f"127.0.0.1:{self.port}" in u for u in urls))

    def test_stops_at_first_refusal_and_follows_nothing_more(self):
        Handler.blocked_paths = {"/pricing"}
        outcome = crawl_mod.crawl_site(f"http://127.0.0.1:{self.port}/", max_pages=10)
        urls = [p["url"] for p in outcome.pages]
        self.assertFalse(any(u.endswith("/pricing") for u in urls))
        self.assertIsNotNone(outcome.halted_reason)
        self.assertIn("403", outcome.halted_reason)


if __name__ == "__main__":
    unittest.main()
