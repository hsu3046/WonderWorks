"""Download the selected CC0 source assets; no runtime API or private credentials.
SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc. https://www.aib.vote
"""
import concurrent.futures
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets'
AGENT = 'Wonderworks-Skyglider/1.0 (https://www.aib.vote)'

def request(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=60)

def metadata(asset):
    with request('https://api.polyhaven.com/files/' + asset) as response:
        return json.load(response)

jobs = []
for asset, name in [('tree_bark_03','bark'), ('aerial_rocks_01','cliff'), ('forest_ground_04','ground'), ('rock_face','stone'), ('rock_wall_08','castle')]:
    data = metadata(asset)
    for kind, suffix in [('Diffuse','color'), ('nor_gl','normal'), ('Rough','roughness')]:
        jobs.append((asset, ROOT / f'{name}-{suffix}.jpg', data[kind]['1k']['jpg']))
data = metadata('fir_tree_01')
for kind, name in [('twig_diff','pine-color'), ('twig_alpha','pine-alpha')]:
    jobs.append(('fir_tree_01', ROOT / f'{name}.jpg', data[kind]['1k']['jpg']))
for asset in ['fern_02', 'rock_moss_set_01']:
    data = metadata(asset)['gltf']['1k']['gltf']
    jobs.append((asset, ROOT / asset / f'{asset}.gltf', data))
    for relative, item in data['include'].items():
        jobs.append((asset, ROOT / asset / relative, item))
data = metadata('kloofendal_48d_partly_cloudy_puresky')['hdri']['2k']['hdr']
jobs.append(('kloofendal_48d_partly_cloudy_puresky', ROOT / 'sky.hdr', data))

def download(job):
    asset, path, item = job
    path.parent.mkdir(parents=True, exist_ok=True)
    with request(item['url']) as response:
        raw = response.read()
    if item.get('md5') and hashlib.md5(raw).hexdigest() != item['md5']:
        raise RuntimeError('Checksum mismatch: ' + str(path))
    path.write_bytes(raw)
    return {'asset': asset, 'source': 'https://polyhaven.com/a/' + asset, 'license': 'CC0-1.0',
            'file': str(path.relative_to(ROOT)), 'bytes':len(raw), 'sha256':hashlib.sha256(raw).hexdigest(), 'download':item['url']}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    result = list(pool.map(download,jobs))
(ROOT / 'manifest.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'files':len(result),'bytes':sum(x['bytes'] for x in result)}))
