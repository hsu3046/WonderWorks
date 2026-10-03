# SPDX-License-Identifier: GPL-3.0-only — © 2026 AIB Inc.
"""Pack Blender LOD exports into one mesh per LOD and one padded texture atlas.
Run after the isolated Blender reduction described in docs/pond/HYDRANGEA.md.
Source textures remain embedded in the user's original, unmodified GLB.
"""
from pathlib import Path
from PIL import Image
import io,json,re,struct,math
ROOT=Path(__file__).resolve().parents[3]
WORK=ROOT/'docs/validation/azalea'
OUT=ROOT/'projects/pond/public/models/azalea-garden-v1.glb'
def read(path):
 raw=path.read_bytes();length=struct.unpack_from('<I',raw,12)[0]
 return json.loads(raw[20:20+length]),raw[28+length:]
near,nearbin=read(WORK/'near.glb')
far,farbin=read(WORK/'far.glb')
SIZE=2048;CELL=256;PAD=8;INNER=CELL-PAD*2
atlases=[Image.new('RGB',(SIZE,SIZE),color) for color in [(40,65,30),(128,128,255)]]
def tile_index(mat):return int(re.search(r'tripo_part_(\d+)',mat['name'])[1])
for material in near['materials']:
 tile=tile_index(material);x=(tile%8)*CELL;y=(tile//8)*CELL
 pbr=material['pbrMetallicRoughness']
 indices=[pbr['baseColorTexture']['index'],material['normalTexture']['index']]
 for atlas,index in zip(atlases,indices):
  image=near['images'][near['textures'][index]['source']];view=near['bufferViews'][image['bufferView']];off=view.get('byteOffset',0)
  im=Image.open(io.BytesIO(nearbin[off:off+view['byteLength']])).convert('RGB').resize((INNER,INNER),Image.Resampling.LANCZOS)
  atlas.paste(im,(x+PAD,y+PAD))
  # Extend the tile edge; prevent adjacent flower/leaf material bleeding in mipmaps.
  atlas.paste(im.crop((0,0,1,INNER)).resize((PAD,INNER)),(x,y+PAD))
  atlas.paste(im.crop((INNER-1,0,INNER,INNER)).resize((PAD,INNER)),(x+PAD+INNER,y+PAD))
  strip=atlas.crop((x,y+PAD,x+CELL,y+PAD+1));atlas.paste(strip.resize((CELL,PAD)),(x,y))
  strip=atlas.crop((x,y+PAD+INNER-1,x+CELL,y+PAD+INNER));atlas.paste(strip.resize((CELL,PAD)),(x,y+PAD+INNER))

def values(j,b,idx):
 a=j['accessors'][idx];v=j['bufferViews'][a['bufferView']];width={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']];fmt={5126:'f',5125:'I',5123:'H'}[a['componentType']]
 stride=v.get('byteStride',width*struct.calcsize(fmt));start=v.get('byteOffset',0)+a.get('byteOffset',0)
 return [struct.unpack_from('<'+fmt*width,b,start+i*stride) for i in range(a['count'])]
result={'asset':{'version':'2.0','generator':'AIB Inc. — Blender reduction and padded atlas'},'scene':0,'scenes':[{'nodes':[0,1]}],'nodes':[],'meshes':[],'materials':[{'name':'Azalea authored atlas','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.92},'normalTexture':{'index':1,'scale':.55}}],'accessors':[],'bufferViews':[],'images':[],'textures':[],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'buffers':[],'extensionsUsed':['EXT_texture_webp'],'extensionsRequired':['EXT_texture_webp']}
binary=bytearray()
def view(data):
 binary.extend(b'\0'*(-len(binary)%4));i=len(result['bufferViews']);result['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data);return i
def accessor(data,typ,component):
 flat=[v for row in data for v in row];fmt='f' if component==5126 else 'I';v=view(struct.pack('<'+fmt*len(flat),*flat));a={'bufferView':v,'componentType':component,'count':len(data),'type':typ}
 if typ=='VEC3':a.update(min=[min(x[i] for x in data) for i in range(3)],max=[max(x[i] for x in data) for i in range(3)])
 idx=len(result['accessors']);result['accessors'].append(a);return idx
for level,(j,b) in enumerate([(near,nearbin),(far,farbin)]):
 positions=[];normals=[];uvs=[];indices=[]
 for node in j['nodes']:
  if 'mesh' not in node:continue
  assert not any(k in node for k in ['translation','rotation','scale','matrix']),'Bake node transforms before packing'
  for p in j['meshes'][node['mesh']]['primitives']:
   offset=len(positions);attrs=p['attributes'];tile=tile_index(j['materials'][p['material']]);x=(tile%8)*CELL+PAD;y=(tile//8)*CELL+PAD
   positions+=values(j,b,attrs['POSITION']);normals+=values(j,b,attrs['NORMAL'])
   for u,v in values(j,b,attrs['TEXCOORD_0']):
    assert -.001<=u<=1.001 and -.001<=v<=1.001
    uvs.append(((x+min(1,max(0,u))*INNER)/SIZE,(y+min(1,max(0,v))*INNER)/SIZE))
   indices += [(i[0]+offset,) for i in values(j,b,p['indices'])]
 primitive={'attributes':{'POSITION':accessor(positions,'VEC3',5126),'NORMAL':accessor(normals,'VEC3',5126),'TEXCOORD_0':accessor(uvs,'VEC2',5126)},'indices':accessor(indices,'SCALAR',5125),'material':0}
 result['meshes'].append({'name':['AzaleaNear','AzaleaFar'][level],'primitives':[primitive]});result['nodes'].append({'mesh':level,'name':['AzaleaNear','AzaleaFar'][level]})
 print(['Near','Far'][level],len(indices)//3,'triangles')
for i,atlas in enumerate(atlases):
 stream=io.BytesIO();atlas.save(stream,format='WEBP',quality=93,lossless=i>0,method=6)
 result['images'].append({'bufferView':view(stream.getvalue()),'mimeType':'image/webp','name':['Azalea color','Azalea normal','Azalea roughness'][i]})
 result['textures'].append({'sampler':0,'extensions':{'EXT_texture_webp':{'source':i}}})
result['buffers']=[{'byteLength':len(binary)}];header=json.dumps(result,separators=(',',':')).encode();header+=b' '*(-len(header)%4);binary.extend(b'\0'*(-len(binary)%4))
OUT.write_bytes(struct.pack('<III',0x46546c67,2,28+len(header)+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary)
print(OUT.name,OUT.stat().st_size,'bytes')
