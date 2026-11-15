import sys,pathlib,json,math,time
import numpy as np
from PIL import Image
import argparse
p=argparse.ArgumentParser(description='Build lossless NASA MOLA terrain tiles and metric normal maps.')
p.add_argument('--source-dir',required=True,type=pathlib.Path)
p.add_argument('--output-dir',required=True,type=pathlib.Path)
a=p.parse_args();root=a.source_dir;out=a.output_dir
for sub in ['dem128','normal128','topography128','source-labels']:(out/sub).mkdir(exist_ok=True)
W,H,T=46080,23040,512
maps={}
for band,lat in enumerate(['88n','44n','00n','44s']):
 for q,lon in enumerate([0,90,180,270]):
  name=f'megt{lat}{lon:03d}hb';p=root/(name+'.img')
  if not p.exists() or p.stat().st_size!=129761280:raise RuntimeError(f'Missing complete {name}')
  maps[band,q]=np.memmap(p,dtype='>i2',mode='r',shape=(5632,11520))
  (out/'source-labels'/(name+'.lbl')).write_bytes((root/(name+'.lbl')).read_bytes())
base=np.memmap(out/'elevation-32.bin',dtype='<i2',mode='r',shape=(5760,11520))
levels=np.array([-8200,-4000,0,5000,10000,15000,21500]);colors=np.array([[13,30,74],[29,94,151],[81,151,140],[225,185,111],[183,87,51],[197,153,139],[247,240,232]])

def read(ys,xs):
 ys=np.clip(np.asarray(ys,dtype=int),0,H-1);xs=np.asarray(xs,dtype=int)%W
 arr=np.empty((len(ys),len(xs)),np.float32)
 # global longitude -180 maps to original source quadrant180.
 ox=(xs+W//2)%W
 bands=np.floor_divide(ys-256,5632)
 for band in np.unique(bands):
  ri=np.where(bands==band)[0];yy=ys[ri]
  if band<0 or band>3:
   # Explicit32ppd polar fallback, interpolated rather than pretending128ppd observations.
   fy=(yy+.5)/4-.5;fx=(xs+.5)/4-.5
   iy=np.clip(np.floor(fy).astype(int),0,5759);ix=np.floor(fx).astype(int)%11520
   wy=np.clip(fy-iy,0,1)[:,None];wx=(fx-np.floor(fx))[None,:]
   a=base[np.ix_(iy,ix)].astype(np.float32);b=base[np.ix_(iy,(ix+1)%11520)].astype(np.float32)
   c=base[np.ix_(np.minimum(5759,iy+1),ix)].astype(np.float32);d=base[np.ix_(np.minimum(5759,iy+1),(ix+1)%11520)].astype(np.float32)
   arr[ri,:]=(a*(1-wx)+b*wx)*(1-wy)+(c*(1-wx)+d*wx)*wy
  else:
   localy=yy-256-int(band)*5632
   for q in np.unique(ox//11520):
    ci=np.where(ox//11520==q)[0];localx=ox[ci]%11520
    arr[np.ix_(ri,ci)]=maps[int(band),int(q)][np.ix_(localy,localx)]
 return arr

def shade(z):
 rgb=np.empty((*z.shape,3),np.uint8)
 for c in range(3):rgb[:,:,c]=np.interp(z,levels,colors[:,c]).astype(np.uint8)
 return rgb

def normal(z,ys):
 # z includes one-cell halo in all directions, metric tangents east/north.
 lat=(90-(ys+.5)/128)*math.pi/180
 step=3389500*math.pi/180/128
 dx=(z[1:-1,2:]-z[1:-1,:-2])/(2*step*np.maximum(.001,np.cos(lat))[:,None])
 dy=(z[2:,1:-1]-z[:-2,1:-1])/(2*step)
 length=np.sqrt(1+dx*dx+dy*dy)
 n=np.empty((*dx.shape,3),np.uint8)
 for c,v in enumerate([-dx/length,dy/length,1/length]):n[:,:,c]=np.clip((v*.5+.5)*255,0,255).astype(np.uint8)
 return n

for ty in range(H//T):
 for tx in range(W//T):
  target=out/'dem128'/f'{tx}_{ty}.bin'
  ys=np.arange(ty*T,(ty+1)*T);xs=np.arange(tx*T,(tx+1)*T)
  z=read(np.arange(ty*T-1,(ty+1)*T+1),np.arange(tx*T-1,(tx+1)*T+1))
  center=np.rint(z[1:-1,1:-1]).astype('<i2');center.tofile(target)
  Image.fromarray(normal(z,ys)).save(out/'normal128'/f'{tx}_{ty}.png',compress_level=2)
  Image.fromarray(shade(z[1:-1,1:-1])).save(out/'topography128'/f'{tx}_{ty}.png',compress_level=2)
 print('row',ty+1,'/45',flush=True)
# Overview pixels sample native grid; all overview normals now derive from128ppd.
width,height=8192,4096
rx=np.floor((np.arange(width)+.5)*W/width).astype(int)
rgb=np.empty((height,width,3),np.uint8);norm=np.empty_like(rgb)
for y0 in range(0,height,64):
 y1=min(height,y0+64);ry=np.floor((np.arange(y0,y1)+.5)*H/height).astype(int)
 center=read(ry,rx);rgb[y0:y1]=shade(center)
 east=read(ry,rx+1);west=read(ry,rx-1);south=read(ry+1,rx);north=read(ry-1,rx)
 lat=(90-(ry+.5)/128)*math.pi/180;step=3389500*math.pi/180/128
 dx=(east-west)/(2*step*np.maximum(.001,np.cos(lat))[:,None]);dy=(south-north)/(2*step)
 length=np.sqrt(1+dx*dx+dy*dy)
 for c,v in enumerate([-dx/length,dy/length,1/length]):norm[y0:y1,:,c]=np.clip((v*.5+.5)*255,0,255).astype(np.uint8)
Image.fromarray(rgb).save(out/'topography-8k.png',compress_level=3)
Image.fromarray(norm).save(out/'normal-8k.png',compress_level=3)
p=out/'manifest.json';m=json.loads(p.read_text())
detail={'directory':'assets/hires/dem128','width':W,'height':H,'tileSize':T,'urlTemplate':'assets/hires/dem128/{x}_{y}.bin','encoding':'int16-le','west':-180,'north':90,'pixelCenters':True,'sourcePixelsPerDegree':128,'metersPerPixelEquator':3389500*math.pi/180/128,'polarFallback':{'latitudeAbsGreaterThan':88,'sourcePixelsPerDegree':32,'method':'bilinear interpolation'},'note':'Highest global MOLA cylindrical product:128ppd between88S and88N; outer2degree caps use separately identified32ppd fallback. Finer HiRISE DEMs exist only regionally; this is not global sub-meter terrain.'}
m['detail']=detail
for key,folder in [('normalTiles','normal128'),('reliefTiles','topography128')]:m[key]={**detail,'directory':'assets/hires/'+folder,'urlTemplate':'assets/hires/'+folder+'/{x}_{y}.png','encoding':'png-rgb'}
m['normalSource']='128ppd native metric elevation gradients, no vertical exaggeration. Polar fallback32ppd.'
m['sources'].append({'title':'NASA PDS MOLA128ppd complete cylindrical terrain','url':'https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg128/','note':'All16 NASA MOLA128ppd tiles ingested losslessly into512×512 little-endian signed-meter browser tiles. Elevation color and tangent-space normal maps independently derived from this elevation, not blended with imagery. Cylindrical coverage88S–88N; poles use32ppd fallback.'})
p.write_text(json.dumps(m,indent=2));print('manifest128 complete',flush=True)
