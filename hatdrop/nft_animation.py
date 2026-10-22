import gzip
import hashlib
import io
import json
import re
import threading
import time
import urllib.request
from pathlib import Path

SLUG=re.compile(r'[a-z][a-z0-9]{1,63}-[1-9][0-9]{0,10}\Z')
LIMIT=6_000_000
slots=threading.BoundedSemaphore(2)

def decode(raw):
    if raw[:2]==b'\x1f\x8b':
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as source:raw=source.read(LIMIT+1)
    if len(raw)>LIMIT:raise ValueError('animation too large')
    data=json.loads(raw)
    if not isinstance(data,dict) or not isinstance(data.get('layers'),list) or not 1<=float(data.get('w',0))<=2048 or not 1<=float(data.get('h',0))<=2048:raise ValueError('invalid animation')
    if not 1<=float(data.get('fr',0))<=120 or not 0<float(data.get('op',0))-float(data.get('ip',0))<=7200:raise ValueError('invalid duration')
    for asset in data.get('assets',[]):
        if asset.get('u') or asset.get('p') and not str(asset['p']).startswith('data:image/'):raise ValueError('external animation asset')
    return json.dumps(data,separators=(',',':')).encode()

def install(g):
    failures={}
    @g['app'].get('/nft-animation/<slug>.json')
    def nft_animation(slug):
        slug=slug.lower()
        if not SLUG.fullmatch(slug):return ('',404)
        folder=Path(g['MEDIA_DIR'])/'gift-animations';target=folder/(slug+'.json')
        def cached():
            try:
                if time.time()-target.stat().st_mtime<604800 and target.stat().st_size<=LIMIT:return target.read_bytes()
            except OSError:pass
            return None
        raw=cached()
        if raw is None:
            if failures.get(slug,0)>time.time():return ('',404)
            if not slots.acquire(timeout=1):return ('',503)
            try:
                raw=cached()
                if raw is None:
                    for suffix in ('tgs','lottie.json'):
                        try:
                            request=urllib.request.Request(f'https://nft.fragment.com/gift/{slug}.{suffix}',headers={'User-Agent':'Mozilla/5.0','Referer':'https://t.me/'})
                            with urllib.request.urlopen(request,timeout=8) as source:raw=decode(source.read(1_500_001))
                            folder.mkdir(parents=True,exist_ok=True);temporary=target.with_suffix(f'.{threading.get_ident()}.tmp');temporary.write_bytes(raw);temporary.replace(target)
                            cached_files=list(folder.glob('*.json'))
                            if len(cached_files)>256:
                                for old in sorted(cached_files,key=lambda path:path.stat().st_mtime)[:-256]:
                                    try:old.unlink()
                                    except OSError:pass
                            break
                        except Exception:raw=None
                    if raw is None:
                        if len(failures)>128:failures.clear()
                        failures[slug]=time.time()+60
                        return ('',404)
            finally:slots.release()
        response=g['app'].response_class(raw,mimetype='application/json')
        response.headers['Cache-Control']='public, max-age=86400';response.set_etag(hashlib.sha256(raw).hexdigest())
        return response.make_conditional(g['request'])
