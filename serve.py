#!/usr/bin/env python3
"""
Dev server for the radio site.

Python's built-in http.server ignores HTTP Range requests, which silently
breaks seeking into an audio file — the station clock says 03:12 but the
audio is still at 00:09. Every real static host (Netlify, Vercel,
Cloudflare Pages, GitHub Pages) supports Range, so this only exists to
make local preview behave like production.
"""
import http.server, os, re, socketserver, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4747

TYPES = {
    ".m4a": "audio/mp4", ".mp3": "audio/mpeg", ".flac": "audio/flac",
    ".wav": "audio/wav", ".ogg": "audio/ogg", ".opus": "audio/ogg",
    ".mp4": "video/mp4", ".webm": "video/webm", ".m4v": "video/mp4",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return TYPES.get(ext) or super().guess_type(path)

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()

        path = self.translate_path(self.path)
        if not os.path.isfile(path):
            return super().send_head()

        m = re.match(r"bytes=(\d*)-(\d*)", rng.strip())
        if not m:
            return super().send_head()

        size = os.path.getsize(path)
        start, end = m.group(1), m.group(2)

        if start == "":                      # suffix range: last N bytes
            length = int(end or 0)
            start, end = max(0, size - length), size - 1
        else:
            start = int(start)
            end = int(end) if end else size - 1

        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None

        end = min(end, size - 1)
        f = open(path, "rb")
        f.seek(start)

        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        return _Slice(f, end - start + 1)


class _Slice:
    """File wrapper that stops after `remaining` bytes, for copyfile()."""
    def __init__(self, f, remaining):
        self.f, self.remaining = f, remaining

    def read(self, n=-1):
        if self.remaining <= 0:
            return b""
        if n < 0 or n > self.remaining:
            n = self.remaining
        data = self.f.read(n)
        self.remaining -= len(data)
        return data

    def close(self):
        self.f.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"radio dev server → http://localhost:{PORT}")
        httpd.serve_forever()
