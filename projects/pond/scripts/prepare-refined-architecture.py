# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Make web copies of supplied GLBs: retain geometry/materials, resize maps to 2K WebP."""
from pathlib import Path
import io, json, struct
from PIL import Image
root = Path(__file__).resolve().parents[3]
for name, output in [('Wooden_Bridge_Refined', 'wooden-bridge-refined-v1'), ('Wooden_Gazebo_Refined', 'wooden-gazebo-refined-v1')]:
    source = root / 'assets' / name / (name + '_v1.glb')
    raw = source.read_bytes()
    length = struct.unpack_from('<I', raw, 12)[0]
    gltf = json.loads(raw[20:20+length]); binary = raw[28+length:]
    images = {im['bufferView']: im for im in gltf['images']}
    packed = bytearray()
    for index, view in enumerate(gltf['bufferViews']):
        start = view.get('byteOffset', 0)
        data = binary[start:start+view['byteLength']]
        if index in images:
            im = Image.open(io.BytesIO(data)); im.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            stream = io.BytesIO()
            # Data maps retain lossless encoding; color maps use high-quality compression.
            im.save(stream, format='WEBP', lossless='basecolor' not in images[index].get('name','').lower(), quality=92, method=6)
            data = stream.getvalue(); images[index]['mimeType'] = 'image/webp'
        while len(packed) % 4: packed.append(0)
        view['byteOffset'] = len(packed); view['byteLength'] = len(data); packed.extend(data)
    for tex in gltf['textures']:
        if 'source' in tex:
            tex.setdefault('extensions', {})['EXT_texture_webp'] = {'source': tex.pop('source')}
    for key in ['extensionsUsed', 'extensionsRequired']:
        if 'EXT_texture_webp' not in gltf.setdefault(key, []): gltf[key].append('EXT_texture_webp')
    gltf['buffers'][0]['byteLength'] = len(packed)
    header = json.dumps(gltf, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4); packed.extend(b'\0' * (-len(packed) % 4))
    result = struct.pack('<III', 0x46546c67, 2, 28+len(header)+len(packed)) + struct.pack('<II', len(header), 0x4e4f534a) + header + struct.pack('<II', len(packed), 0x004e4942) + packed
    target = root / 'projects/pond/public/models' / (output + '.glb')
    target.write_bytes(result)
    print(f'{source.name}: {len(raw)} -> {len(result)} bytes; geometry unchanged')
