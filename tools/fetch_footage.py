#!/usr/bin/env python3
"""
Pull short loops out of archive.org items and encode them for the station.

Nothing is downloaded whole. ffmpeg seeks over HTTP with range requests, so a
4GB source costs us only the seconds we actually keep.

Clips are encoded desaturated on purpose: the page renders them through
filter:grayscale(1) anyway, so throwing the chroma away costs nothing visible
and buys a meaningfully lower bitrate.
"""
import json, os, subprocess, sys, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "video")
os.makedirs(OUT, exist_ok=True)

# id, slug, how many clips, preferred file extensions in order
SOURCES = [
    ("introductiontothecathoderayoscilloscope", "cro",       3, (".mp4", ".ogv")),
    ("youtube-OHNXot0w7A0",                     "torus",     2, (".mp4", ".webm")),
    ("LearningAboutSound",                      "sound",     3, (".ogv", ".mp4")),
    ("Manormouse-NeverFullyRecoveredEp",        "manormouse",2, (".mp4", ".ogv")),
    ("FreedomH1956",                            "highway",   2, (".mp4", ".avi")),
    ("AlbionMoonlightThePIRATEUTOPIAExperimentsVividTribeOfPsychics",
                                                "pirate",    2, (".mp4",)),
    ("mtv_16.12.2023-chillout_zone",            "chillout1", 3, (".mp4",)),
    ("mtv_chillout_zone_9.12.2023",             "chillout2", 3, (".mp4",)),
    ("WelcomeToCyberia",                        "cyberia",   3, (".ogv", ".mp4")),
]

CLIP = 34  # seconds per clip


def meta(ident):
    url = f"https://archive.org/metadata/{ident}"
    with urllib.request.urlopen(url, timeout=40) as r:
        return json.load(r)


def pick(m, exts):
    """smallest file matching the earliest-preferred extension"""
    files = m.get("files", [])
    for ext in exts:
        c = [f for f in files if f.get("name", "").lower().endswith(ext)
             and int(f.get("size") or 0) > 0]
        if c:
            return min(c, key=lambda f: int(f["size"]))
    return None


def duration(m, f):
    for src in (f, m.get("metadata", {})):
        v = src.get("length")
        if not v:
            continue
        try:
            if ":" in str(v):
                p = [float(x) for x in str(v).split(":")]
                while len(p) < 3:
                    p.insert(0, 0.0)
                return p[0] * 3600 + p[1] * 60 + p[2]
            return float(v)
        except ValueError:
            pass
    return None


def grab(url, start, dst):
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
        "-reconnect", "1", "-reconnect_streamed", "1",
        "-reconnect_delay_max", "5",
        "-ss", str(int(start)), "-i", url, "-t", str(CLIP),
        "-an",                                   # no audio track at all
        "-vf", "hue=s=0,scale=640:-2,fps=24",    # desaturate, shrink, cap fps
        "-c:v", "libx264", "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-b:v", "340k", "-maxrate", "420k", "-bufsize", "800k",
        "-movflags", "+faststart",
        dst,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if r.returncode != 0:
        print("      ffmpeg:", (r.stderr or "").strip().split("\n")[-1][:110])
        return False
    return os.path.exists(dst) and os.path.getsize(dst) > 40_000


def main():
    made = []
    for ident, slug, n, exts in SOURCES:
        print(f"\n== {slug}  ({ident[:44]})")
        try:
            m = meta(ident)
        except Exception as e:
            print("   metadata failed:", e)
            continue

        f = pick(m, exts)
        if not f:
            print("   no usable video file")
            continue

        url = ("https://archive.org/download/" + ident + "/" +
               urllib.parse.quote(f["name"]))
        dur = duration(m, f)
        print(f"   src {f['name'][:46]}  "
              f"{int(f['size'])/1e6:.0f}MB  dur={int(dur) if dur else '?'}s")

        # spread clips through the middle of the piece, skipping titles/credits
        if dur and dur > 120:
            pts = [dur * p for p in ([.25, .5, .72] if n >= 3 else [.3, .62])][:n]
        else:
            pts = [20 + i * 45 for i in range(n)]

        for i, s in enumerate(pts, 1):
            dst = os.path.join(OUT, f"{slug}{i}.mp4")
            print(f"   -> {slug}{i}.mp4 @ {int(s)}s ...", end=" ", flush=True)
            if grab(url, s, dst):
                mb = os.path.getsize(dst) / 1e6
                print(f"{mb:.1f}MB")
                made.append((f"{slug}{i}.mp4", mb))
            else:
                print("failed")
                if os.path.exists(dst):
                    os.remove(dst)

    print("\n================ done")
    for name, mb in made:
        print(f"  {name:20} {mb:5.1f} MB")
    print(f"  {len(made)} clips, {sum(m for _, m in made):.1f} MB total")


if __name__ == "__main__":
    main()
