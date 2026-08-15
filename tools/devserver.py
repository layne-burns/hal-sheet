"""Static server for local checking, with caching turned off.

python -m http.server sends Last-Modified and no Cache-Control, which lets
a browser decide freshness by guesswork — so an edited file can keep being
served from the browser's own cache long after it changed. That is fine for
the real deployment (the service worker revalidates) but during development
it means verifying a change you cannot actually see yet.

Every response here says no-store, so what you load is what is on disk.
"""
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # the request log drowns out anything useful


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8137
    print("serving on http://127.0.0.1:%d (no-store)" % port, flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), NoCacheHandler).serve_forever()
