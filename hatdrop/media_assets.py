
import base64
import hashlib
import io
import re
import secrets
from pathlib import Path
from PIL import Image

NAME = re.compile(r"[a-f0-9]{64}\.(?:png|jpg|webp)\Z")


def store_raster(encoded, folder):
    if not isinstance(encoded, str) or len(encoded) > 7_000_000:
        raise ValueError('Изображение должно быть не больше 5 МБ.')
    try:
        raw = base64.b64decode(encoded, validate=True)
        if not raw or len(raw) > 5_000_000:
            raise ValueError()
        with Image.open(io.BytesIO(raw)) as probe:
            fmt = probe.format
            width, height = probe.size
            if fmt not in ('PNG', 'JPEG', 'WEBP') or width * height > 16_000_000 or min(width, height) < 16:
                raise ValueError()
            probe.verify()
        with Image.open(io.BytesIO(raw)) as image:
            transparent = image.convert('RGBA').getchannel('A').getextrema()[0] < 255
    except Exception as exc:
        raise ValueError('Загрузите PNG, JPEG или WebP до 5 МБ и 16 Мп.') from exc
    ext = {'PNG': 'png', 'JPEG': 'jpg', 'WEBP': 'webp'}[fmt]
    filename = hashlib.sha256(raw).hexdigest() + '.' + ext
    target = Path(folder)
    target.mkdir(parents=True, exist_ok=True)
    path = target / filename
    if not path.exists():
        temporary = target / (filename + '.' + secrets.token_hex(6) + '.tmp')
        temporary.write_bytes(raw)
        temporary.replace(path)
    return {'url': '/media/' + filename, 'transparent': transparent, 'width': width, 'height': height}
