"""Crawl borné d'un site concurrent : accueil, puis liens internes, jusqu'à max_pages.

Arrêt net à la première réponse de refus (401, 403, 407, 429, 503, page captcha) : on ne
réessaie pas et on ne suit plus aucun lien. Respect de robots.txt activé.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlsplit

from scrapling.spiders import Request, Response, Spider

from .url_policy import (
    MAX_PAGES_HARD_CAP,
    assert_public_http_url,
    canonical,
    looks_blocked,
    should_follow,
)

MAX_HTML_CHARS = 300_000


@dataclass
class CrawlOutcome:
    pages: list[dict[str, Any]] = field(default_factory=list)
    halted_reason: str | None = None
    robots_disallowed: int = 0


class CompetitorSpider(Spider):
    name = "rivalys-competitor"
    concurrent_requests = 2
    concurrent_requests_per_domain = 2
    download_delay = 1.0
    robots_txt_obey = True
    max_blocked_retries = 0  # un refus n'est jamais réessayé
    development_mode = False

    def __init__(self, start_url: str, max_pages: int = 20):
        super().__init__()
        assert_public_http_url(start_url)
        self.max_pages = min(max_pages, MAX_PAGES_HARD_CAP)
        netloc = urlsplit(start_url).netloc.lower()
        self.host = urlsplit(start_url).hostname or ""
        self.start_urls = [canonical(start_url)]
        # Scrapling compare le netloc (port inclus) : on borne au même netloc.
        self.allowed_domains = {netloc}
        self.outcome = CrawlOutcome()
        self._queued: set[str] = {canonical(start_url)}
        self._halted = False

    def _halt(self, reason: str) -> None:
        if not self._halted:
            self._halted = True
            self.outcome.halted_reason = reason

    async def is_blocked(self, response: Response) -> bool:
        body = response.body.decode("utf-8", "replace") if isinstance(response.body, bytes) else str(response.body)
        if looks_blocked(response.status, body):
            self._halt(f"refus du site (statut {response.status})")
            return True
        return False

    async def parse(self, response: Response):
        if self._halted:
            return
        content_type = (response.headers.get("content-type") or "").lower() if response.headers else ""
        if content_type and "html" not in content_type:
            return
        if len(self.outcome.pages) >= self.max_pages:
            self._halt("plafond de pages atteint")
            return

        body = response.body.decode("utf-8", "replace") if isinstance(response.body, bytes) else str(response.body)
        self.outcome.pages.append(
            {"url": str(response.url), "status": response.status, "html": body[:MAX_HTML_CHARS]}
        )
        yield {"url": str(response.url)}

        if len(self.outcome.pages) + len(self._queued) - 1 >= self.max_pages:
            return
        for href in response.css("a::attr(href)").getall():
            if self._halted:
                return
            target = should_follow(href, str(response.url), self.host)
            if target is None or target in self._queued:
                continue
            if len(self.outcome.pages) + len(self._queued) >= self.max_pages:
                break
            self._queued.add(target)
            yield response.follow(target, callback=self.parse)


def crawl_site(start_url: str, max_pages: int = 20) -> CrawlOutcome:
    spider = CompetitorSpider(start_url, max_pages=max_pages)
    result = spider.start()
    outcome = spider.outcome
    outcome.robots_disallowed = getattr(result.stats, "robots_disallowed_count", 0) or 0
    return outcome
