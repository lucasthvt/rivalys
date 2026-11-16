import unittest

from rivalys_crawler.url_policy import (
    UnsafeUrl,
    assert_public_http_url,
    canonical,
    looks_blocked,
    same_site,
    should_follow,
)


class PublicUrlTests(unittest.TestCase):
    def test_accepts_public_https(self):
        assert_public_http_url("https://example.com/pricing")

    def test_rejects_bad_scheme(self):
        with self.assertRaises(UnsafeUrl):
            assert_public_http_url("file:///etc/passwd")

    def test_rejects_loopback_and_private_ipv4(self):
        for url in ["http://127.0.0.1/", "http://10.0.0.1/", "http://192.168.1.1/", "http://169.254.169.254/"]:
            with self.subTest(url=url), self.assertRaises(UnsafeUrl):
                assert_public_http_url(url)

    def test_rejects_ipv6_literals(self):
        for url in ["http://[::1]/", "http://[::ffff:a9fe:a9fe]/", "http://[fd00::1]/"]:
            with self.subTest(url=url), self.assertRaises(UnsafeUrl):
                assert_public_http_url(url)

    def test_rejects_localhost_names(self):
        for url in ["http://localhost/", "http://api.localhost/"]:
            with self.subTest(url=url), self.assertRaises(UnsafeUrl):
                assert_public_http_url(url)


class FollowTests(unittest.TestCase):
    def test_same_site_includes_subdomains_and_www(self):
        self.assertTrue(same_site("https://www.example.com/a", "example.com"))
        self.assertTrue(same_site("https://blog.example.com/a", "example.com"))
        self.assertFalse(same_site("https://evil-example.com/a", "example.com"))
        self.assertFalse(same_site("https://example.com.evil.net/a", "example.com"))

    def test_follows_relative_internal_links(self):
        self.assertEqual(
            should_follow("/pricing#faq", "https://example.com/", "example.com"),
            "https://example.com/pricing",
        )

    def test_drops_external_mailto_and_assets(self):
        page = "https://example.com/"
        self.assertIsNone(should_follow("https://other.net/x", page, "example.com"))
        self.assertIsNone(should_follow("mailto:a@example.com", page, "example.com"))
        self.assertIsNone(should_follow("#top", page, "example.com"))
        self.assertIsNone(should_follow("/logo.png", page, "example.com"))
        self.assertIsNone(should_follow("/doc.pdf", page, "example.com"))

    def test_drops_links_to_private_targets(self):
        self.assertIsNone(should_follow("http://169.254.169.254/", "https://example.com/", "example.com"))

    def test_canonical_dedups_trailing_slash_and_fragment(self):
        self.assertEqual(canonical("https://Example.com/pricing/#x"), canonical("https://example.com/pricing"))


class BlockedTests(unittest.TestCase):
    def test_refusal_statuses_are_blocked(self):
        for status in (401, 403, 429, 503):
            with self.subTest(status=status):
                self.assertTrue(looks_blocked(status, ""))

    def test_captcha_page_is_blocked(self):
        self.assertTrue(looks_blocked(200, "<html>Please verify you are human</html>"))

    def test_normal_page_is_not_blocked(self):
        self.assertFalse(looks_blocked(200, "<html>Pricing</html>"))


if __name__ == "__main__":
    unittest.main()
