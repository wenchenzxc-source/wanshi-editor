import { useEffect, useRef, useState } from 'react';
import { Preview } from './Canvas';
import { dimensions, type Design, type Template } from '../shared/model';

type Point = [number, number];
// Clockwise aperture corners measured on the 1254 × 1254 source photographs.
export const photoScenes = {
  models: { name: '模型櫃',
    portrait: { src: '/scenes/models-photo-v1.webp', corners: [[464,427],[787,427],[787,876],[464,876]] as Point[] },
    landscape: { src: '/scenes/models-landscape-v1.webp', corners: [[363,447],[892,447],[892,784],[363,784]] as Point[] },
  },
  dolls: { name: '娃娃牆',
    portrait: { src: '/scenes/dolls-photo-v1.webp', corners: [[465,389],[789,389],[789,852],[465,852]] as Point[] },
    landscape: { src: '/scenes/dolls-landscape-v1.webp', corners: [[399,475],[858,475],[858,791],[399,791]] as Point[] },
  },
  desk: { name: '溫暖桌面',
    portrait: { src: '/scenes/desk-photo-v1.webp', corners: [[405,265],[855,265],[855,887],[405,887]] as Point[] },
    landscape: { src: '/scenes/desk-landscape-v1.webp', corners: [[314,398],[956,398],[956,831],[314,831]] as Point[] },
  },
  shelf: { name: '生活層架',
    portrait: { src: '/scenes/shelf-photo-v1.webp', corners: [[394,272],[860,272],[860,905],[394,905]] as Point[] },
    landscape: { src: '/scenes/shelf-landscape-v1.webp', corners: [[315,386],[945,386],[945,804],[315,804]] as Point[] },
  },
  wall: { name: '居家牆面',
    portrait: { src: '/scenes/wall-photo-v1.webp', corners: [[472,300],[783,300],[783,747],[472,747]] as Point[] },
    landscape: { src: '/scenes/wall-landscape-v1.webp', corners: [[333,345],[930,345],[930,738],[333,738]] as Point[] },
  },
  gallery: { name: '藝廊展台',
    portrait: { src: '/scenes/gallery-photo-v1.webp', corners: [[411,275],[842,275],[842,860],[411,860]] as Point[] },
    landscape: { src: '/scenes/gallery-landscape-v1.webp', corners: [[297,371],[951,371],[951,800],[297,800]] as Point[] },
  },
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
