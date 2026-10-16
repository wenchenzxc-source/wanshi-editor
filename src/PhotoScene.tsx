import { useEffect, useRef, useState } from 'react';
import { Preview } from './Canvas';
import { dimensions, type Design, type Template } from '../shared/model';

type Point = [number, number];
// Clockwise aperture corners measured on the 1254 × 1254 source photographs.
export const photoScenes = {
  bedside: { name: '床頭櫃',
    portrait: { src: '/scenes/bedside-photo-v1.webp', corners: [[698,358],[1058,351],[1054,870],[687,855]] as Point[] },
    landscape: { src: '/scenes/bedside-landscape-v1.webp', corners: [[651,547],[1109,543],[1111,850],[650,841]] as Point[] },
  },
  computer: { name: '電腦桌',
    portrait: { src: '/scenes/computer-photo-v1.webp', corners: [[684,340],[1085,333],[1086,923],[684,905]] as Point[] },
    landscape: { src: '/scenes/computer-landscape-v1.webp', corners: [[564,549],[1138,545],[1138,912],[562,893]] as Point[] },
  },
};
export type PhotoSceneId = keyof typeof photoScenes;

// Homography from a square DOM plane into the photographic frame aperture.
// CSS perspective division keeps all four corners registered at every viewport size.
export function apertureMatrix(corners: Point[], size: number) {
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = corners.map(([x,y]) => [x/1254,y/1254]);
  const dx1=x1-x2, dx2=x3-x2, dx3=x0-x1+x2-x3;
  const dy1=y1-y2, dy2=y3-y2, dy3=y0-y1+y2-y3;
  const det=dx1*dy2-dx2*dy1;
  const g=(dx3*dy2-dx2*dy3)/det, h=(dx1*dy3-dx3*dy1)/det;
  const a=x1-x0+g*x1, b=x3-x0+h*x3, d=y1-y0+g*y1, e=y3-y0+h*y3;
  return `matrix3d(${[a,d,0,g/size,b,e,0,h/size,0,0,1,0,x0*size,y0*size,0,1].join(',')})`;
}
export function PhotoScene({ scene, design, template, images }: { scene: PhotoSceneId; design: Design; template: Template; images: Map<string, HTMLImageElement> }) {
  const container = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0), [failedSrc, setFailedSrc] = useState(''), [loadedSrc, setLoadedSrc] = useState('');
  const config = photoScenes[scene], photo = config[design.orientation], {w,h} = dimensions(design, template);
  const [tl,tr,br,bl] = photo.corners;
  const distance = (a: Point,b: Point) => Math.hypot(a[0]-b[0],a[1]-b[1]);
  const apertureRatio = (distance(tl,tr)+distance(bl,br))/(distance(tl,bl)+distance(tr,br));
  const ratio = w/h;
  useEffect(() => { const node=container.current; if (!node) return; const observer=new ResizeObserver(([entry])=>setSize(entry.contentRect.width)); observer.observe(node); return ()=>observer.disconnect(); }, []);
  return <div ref={container} className="photo-scene" data-orientation={design.orientation} aria-label={`${config.name}照片融合預覽`}>
    <img key={photo.src} src={photo.src} alt={`${config.name}${design.orientation === 'landscape' ? '橫式' : '直式'}原木相框場景`} onLoad={()=>{setLoadedSrc(photo.src);setFailedSrc('');}} onError={()=>setFailedSrc(photo.src)}/>
    {size > 0 && loadedSrc === photo.src && failedSrc !== photo.src && <div className="photo-art-plane" style={{transform:apertureMatrix(photo.corners,size)}}>
      <div className="photo-art-fit" style={{width:`${Math.min(1,ratio/apertureRatio)*100}%`,height:`${Math.min(1,apertureRatio/ratio)*100}%`}}>
        <Preview design={design} template={template} images={images}/>
      </div>
      <div className="photo-aperture-light" aria-hidden="true"/>
    </div>}
    {failedSrc === photo.src && <p className="photo-load-error" role="alert">場景圖片載入失敗，請重新整理。</p>}
  </div>;
}
