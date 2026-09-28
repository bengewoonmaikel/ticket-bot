"""Stillness check: mean absolute difference between consecutive frames,
measured on a blurred 160x90 downscale so film grain does not count as motion."""
import subprocess, sys
import numpy as np

src = sys.argv[1]
W, H = 160, 90
cmd = ["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:{H}:flags=area,gblur=sigma=1.2,format=gray", "-f", "rawvideo", "-"]
raw = subprocess.run(cmd, capture_output=True, check=True).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, H, W).astype(np.float32)
d = np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))
fps = 60
print(f"frames: {len(frames)}  duration: {len(frames)/fps:.3f}s")
print(f"motion per frame (mean abs diff, 0-255): min {d.min():.4f}  median {np.median(d):.4f}  max {d.max():.3f}")
low = np.where(d < 0.02)[0]
if len(low):
    print(f"frames with almost no motion (<0.02): {len(low)}  e.g. at t = " + ", ".join(f"{(i+1)/fps:.2f}s" for i in low[:12]))
else:
    print("no still frames")
# per half second summary
for s in range(0, len(d), 30):
    seg = d[s:s+30]
    print(f"{s/fps:5.1f}s  min {seg.min():.3f}  mean {seg.mean():.3f}", end="   ")
    if (s // 30) % 4 == 3:
        print()
print()
