// Robust EXIF reader for the photo admin. Handles TIFF offsets and RATIONAL values correctly.
(()=>{
  function parseExif(file){
    return new Promise(resolve=>{
      if(!file||(!/jpe?g/i.test(file.type||'')&&!/\.jpe?g$/i.test(file.name||''))) return resolve({});
      const fr=new FileReader();
      fr.onerror=()=>resolve({});
      fr.onload=()=>{
        try{
          const v=new DataView(fr.result);
          if(v.byteLength<4||v.getUint16(0)!==0xFFD8) return resolve({});
          let pos=2,tiff=-1;
          while(pos+4<=v.byteLength){
            if(v.getUint8(pos)!==0xFF){pos++;continue}
            const marker=v.getUint8(pos+1);
            if(marker===0xDA||marker===0xD9) break;
            const len=v.getUint16(pos+2,false);
            if(marker===0xE1&&pos+4+len<=v.byteLength){
              const s=pos+4;
              if(v.getUint8(s)===0x45&&v.getUint8(s+1)===0x78&&v.getUint8(s+2)===0x69&&v.getUint8(s+3)===0x66&&v.getUint8(s+4)===0&&v.getUint8(s+5)===0){tiff=s+6;break}
            }
            if(len<2) break;
            pos+=2+len;
          }
          if(tiff<0||tiff+8>v.byteLength) return resolve({});
          const order=v.getUint16(tiff,false),le=order===0x4949;
          if(!le&&order!==0x4D4D) return resolve({});
          const u16=o=>v.getUint16(o,le),u32=o=>v.getUint32(o,le);
          const sizes={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
          const safe=(o,n=1)=>o>=0&&o+n<=v.byteLength;
          function valuePtr(entry,type,count){
            const bytes=(sizes[type]||1)*count;
            return bytes<=4?entry+8:tiff+u32(entry+8);
          }
          function readValue(entry,type,count){
            const p=valuePtr(entry,type,count); if(!safe(p,Math.min((sizes[type]||1)*count,8))) return undefined;
            if(type===2){let s='';for(let i=0;i<count&&safe(p+i);i++){const c=v.getUint8(p+i);if(!c)break;s+=String.fromCharCode(c)}return s.trim()}
            if(type===3) return u16(p);
            if(type===4) return u32(p);
            if(type===5){const d=u32(p+4);return d?u32(p)/d:undefined}
            if(type===9) return v.getInt32(p,le);
            if(type===10){const d=v.getInt32(p+4,le);return d?v.getInt32(p,le)/d:undefined}
            return undefined;
          }
          function readIFD(off){
            const out={}; if(!safe(off,2)) return out;
            const n=u16(off);
            for(let i=0;i<n;i++){
              const e=off+2+i*12;if(!safe(e,12))break;
              const tag=u16(e),type=u16(e+2),count=u32(e+4);
              try{out[tag]=readValue(e,type,count)}catch{}
            }
            return out;
          }
          if(u16(tiff+2)!==42) return resolve({});
          const ifd0=readIFD(tiff+u32(tiff+4));
          const exifPtr=ifd0[0x8769];
          const ex=Number.isFinite(exifPtr)?readIFD(tiff+exifPtr):{};
          const make=String(ifd0[0x010F]||'').trim(),model=String(ifd0[0x0110]||'').trim();
          const camera=model?(make&&model.toLowerCase().startsWith(make.toLowerCase())?model:[make,model].filter(Boolean).join(' ')):make;
          const lens=String(ex[0xA434]||'').trim();
          const focal=ex[0x920A],ap=ex[0x829D],sh=ex[0x829A],iso=ex[0x8827];
          const dt=String(ex[0x9003]||ifd0[0x0132]||'');
          const shutter=Number.isFinite(sh)&&sh>0?(sh<1?`1/${Math.round(1/sh)}`:`${Math.round(sh*1000)/1000}s`):'';
          resolve({
            camera,
            lens,
            focal_length:Number.isFinite(focal)&&focal>0?`${Math.round(focal*10)/10} mm`:'',
            aperture:Number.isFinite(ap)&&ap>0?`f/${Math.round(ap*10)/10}`:'',
            shutter_speed:shutter,
            iso:Number.isFinite(iso)&&iso>0?String(iso):'',
            taken_at:/^\d{4}:\d{2}:\d{2}/.test(dt)?dt.slice(0,10).replace(/:/g,'-'):''
          });
        }catch{resolve({})}
      };
      fr.readAsArrayBuffer(file.slice(0,8*1024*1024));
    });
  }
  globalThis.readExif=parseExif;
  async function refresh(id){
    const fields=document.querySelector('#modalFields');if(!id||!fields)return;
    const status=document.querySelector(`#replace-status-${id}`);
    try{
      if(status){status.textContent='Reading EXIF…';status.className='status'}
      const r=await fetch(`/api/admin/media/${id}?exif=2`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw new Error();
      const blob=await r.blob(),file=new File([blob],'photo.jpg',{type:blob.type||'image/jpeg'}),meta=await parseExif(file);
      const names=['camera','lens','focal_length','aperture','shutter_speed','iso'];let loaded=0;
      for(const name of names){const el=fields.querySelector(`[data-f="${name}"]`),value=meta[name];if(el&&value){el.value=value;loaded++}}
      if(status){status.textContent=loaded?`EXIF refreshed · ${loaded} fields — Save changes to keep it`:'No usable EXIF found in stored JPEG';status.className=loaded?'status ok':'status bad'}
    }catch{if(status){status.textContent='Could not refresh EXIF';status.className='status bad'}}
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-action="edit"]');if(!b)return;const id=Number(b.dataset.id);setTimeout(()=>refresh(id),75)},true);
})();
