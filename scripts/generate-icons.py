"""Generate the original camera app mark using only Python's standard library."""
import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'public'

def rounded(x, y, left, top, right, bottom, radius):
    qx = abs(x - (left + right) / 2) - ((right - left) / 2 - radius)
    qy = abs(y - (top + bottom) / 2) - ((bottom - top) / 2 - radius)
    return math.hypot(max(qx, 0), max(qy, 0)) + min(max(qx, qy), 0) <= radius

def pixel(x, y):
    peach = (255, 79, 179)
    dark = (8, 6, 8)
    body = rounded(x, y, 117, 174, 395, 359, 36)
    top = rounded(x, y, 183, 140, 291, 198, 16)
    inside = rounded(x, y, 132, 189, 380, 344, 22)
    lens = math.hypot(x - 256, y - 266)
    mark = ((body or top) and not inside) or 48 <= lens <= 63 or math.hypot(x - 351, y - 215) < 8
    star = abs(x - 373) + abs(y - 123) < 25 or (abs(x - 373) < 5 and abs(y - 123) < 40) or (abs(x - 373) < 40 and abs(y - 123) < 5)
    return peach if mark or star else dark

def chunk(name, data):
    return struct.pack('!I', len(data)) + name + data + struct.pack('!I', zlib.crc32(name + data) & 0xffffffff)

for size, name in [(192, 'icon-192.png'), (512, 'icon-512.png'), (180, 'apple-touch-icon.png')]:
    raw = bytearray()
    for row in range(size):
        raw.append(0)
        for col in range(size):
            samples = [pixel((col + dx) * 512 / size, (row + dy) * 512 / size) for dx, dy in [(0.25,0.25),(0.75,0.25),(0.25,0.75),(0.75,0.75)]]
            raw.extend(round(sum(p[c] for p in samples) / 4) for c in range(3))
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(raw))) + chunk(b'IEND', b'')
    (ROOT / name).write_bytes(data)
    print(f'Created {name} ({size}×{size})')
