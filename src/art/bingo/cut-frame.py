# 入荷ビンゴの額の絵の、まん中（マスを置く白い紙）と外側（うしろの背景）をすき通しにする。
# 使い方：python3 cut-frame.py 元の絵.webp できた絵.webp（Pillow と numpy がいる）
# ふちとまん中から、明るくて色のうすい所（紙・背景）だけをつなげて消す。色の差 7 以下・いちばん暗い色が 212 以上
import sys, numpy as np
from PIL import Image, ImageFilter
from collections import deque
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB'); a = np.asarray(im).astype(int); h, w, _ = a.shape
mx, mn = a.max(2), a.min(2)
cand = (mn >= 212) & ((mx - mn) <= 7)          # light, nearly neutral (paper / backdrop)
def fill(seeds):
    m = np.zeros((h, w), bool); q = deque()
    for y, x in seeds:
        if cand[y, x] and not m[y, x]: m[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1,0),(-1,0),(0,1),(0,-1)):
            ny, nx = y+dy, x+dx
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not m[ny, nx]: m[ny, nx] = True; q.append((ny, nx))
    return m
edge = [(0,x) for x in range(w)] + [(h-1,x) for x in range(w)] + [(y,0) for y in range(h)] + [(y,w-1) for y in range(h)]
center = [(y, x) for y in range(h*2//5, h*3//5, 8) for x in range(w*2//5, w*3//5, 8)]
out_m, in_m = fill(edge), fill(center)
clear = out_m | in_m
alpha = Image.fromarray(np.where(clear, 0, 255).astype('uint8'))
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))  # keep a hair of edge, soften
rgba = im.copy(); rgba.putalpha(alpha)
rgba.save(dst, 'WEBP', quality=88, alpha_quality=90, method=6)
print(src.split('/')[-1], 'outer', round(out_m.mean(),3), 'inner', round(in_m.mean(),3))
