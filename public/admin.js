// Admin v0.9.4 archive + circa + fixed EXIF autofill + unified navigation.
(async()=>{
  try{
    const r=await fetch('/admin-core.js?v=0.9.0',{cache:'no-store'});
    if(!r.ok) throw new Error(`Admin core failed to load (${r.status})`);
    let code=await r.text();
    const rep=(a,b)=>{if(!code.includes(a))throw new Error('Admin patch marker missing');code=code.replace(a,b)};
    rep('\n}\nfunction visibleItems','\nfunction visibleItems');
    rep("const ADMIN_VERSION='0.8.2';","const ADMIN_VERSION='0.9.4';");
    rep("cats=['wildlife','architecture','landscape','other','archive'];","cats=['animals','architecture','landscape','other'];");
    rep("all=d.photos||[];","all=(d.photos||[]).map(p=>({...p,archived:String(p.category||'').startsWith('archive/'),category:String(p.category||'').replace(/^archive\\//,'').replace(/^wildlife$/,'animals')}));");
    rep("${p.featured?'<span class=\"badge\">Featured</span>':''}","${p.featured?'<span class=\"badge\">Featured</span>':''}${p.archived?'<span class=\"badge\">Archive</span>':''}");
    rep("<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div></div>","<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div><div class=\"check\"><input data-f=\"archived\" type=\"checkbox\" ${p.archived?'checked':''}><label>Archive</label></div></div>");
    rep("<input data-f=\"taken_at\" type=\"date\" value=\"${esc(fmtDate(p.taken_at))}\">","<input data-f=\"taken_at\" type=\"text\" inputmode=\"numeric\" placeholder=\"YYYY, YYYY-MM, or YYYY-MM-DD\" value=\"${esc(String(p.taken_at||'').replace(/^c\\.\\s*/i,''))}\"><div class=\"check\" style=\"margin-top:9px\"><input id=\"modalCirca\" type=\"checkbox\" ${/^c\\.\\s*/i.test(String(p.taken_at||''))?'checked':''}><label>Circa</label></div>");
    rep("f.set('featured',$('#featured').checked?'true':'false');","f.set('featured',$('#featured').checked?'true':'false');if($('#archived')?.checked)f.set('category','archive/'+f.get('category'));");
    rep("f.set('web',x.file);f.set('published',$('#batchPublished').value);","f.set('web',x.file);if(x.archived)f.set('category','archive/'+x.category);f.set('published',$('#batchPublished').value);");
    rep("iso:'',status:''}","iso:'',archived:false,status:''}");
    rep("<div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">","<div class=\"check\" style=\"margin:12px 0\"><input type=\"checkbox\" data-i=\"${i}\" data-f=\"archived\" ${x.archived?'checked':''}><label>Archive</label></div><div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">");
    rep("batch[i][e.target.dataset.f]=e.target.value","batch[i][e.target.dataset.f]=e.target.type==='checkbox'?e.target.checked:e.target.value");
    rep("await bulkPatch({category:e.target.value});e.target.value=''","const c=e.target.value;for(const id of [...selected]){const p=all.find(x=>x.id===id);await patchPhoto(id,{category:(p?.archived?'archive/':'')+c})}selected.clear();e.target.value='';await load()");
    rep("$('#uploadForm').addEventListener('submit',async e=>{e.preventDefault();const s=$('#uploadStatus'),f=new FormData(e.currentTarget);","$('#uploadForm').addEventListener('submit',async e=>{e.preventDefault();const form=e.currentTarget,s=$('#uploadStatus'),f=new FormData(form);");
    rep("e.currentTarget.reset();$('#published').checked=true;await load()","form.reset();$('#published').checked=true;await load()");
    (0,eval)(code);
    const h=document.querySelector('h1'),intro=h?.nextElementSibling,version=document.querySelector('#adminVersion'),logout=document.querySelector('.logout');
    if(h)h.textContent='Ben Toland';
    if(intro&&intro.tagName==='P')intro.textContent='Private publishing console for bentoland.com.';
    if(logout){
      const nav=document.createElement('nav');nav.id='adminNav';nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:22px 0 10px';
      const item=(label,href,active=false)=>{const a=document.createElement('a');a.textContent=label;a.href=href;a.style.cssText=`display:inline-block;padding:9px 12px;border:1px solid #d8d3ca;text-decoration:none;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:${active?'#fff':'#151515'};background:${active?'#151515':'#fff'}`;return a};
      nav.append(item('Photos','/admin',true),item('Journal','/admin/journal'),item('View site','/'),item('Lock','/admin/logout'));
      logout.replaceWith(nav);
    }
    if(version){version.style.marginBottom='4px'}
    const checks=document.querySelector('#uploadForm .checks');
    if(checks&&!document.querySelector('#archived'))checks.insertAdjacentHTML('beforeend','<div class="check"><input id="archived" type="checkbox"><label>Archive</label></div>');
    const uploadDate=document.querySelector('#uploadForm [name="taken_at"]');
    if(uploadDate){uploadDate.type='text';uploadDate.inputMode='numeric';uploadDate.placeholder='YYYY, YYYY-MM, or YYYY-MM-DD';uploadDate.insertAdjacentHTML('afterend','<div class="check" style="margin-top:9px"><input id="circa" type="checkbox"><label>Circa</label></div>')}
    const uploadForm=document.querySelector('#uploadForm');
    const webInput=uploadForm?.querySelector('[name="web"]');
    webInput?.addEventListener('change',async()=>{
      const file=webInput.files?.[0],status=document.querySelector('#uploadStatus');if(!file)return;if(status){status.textContent='Reading EXIF…';status.className='status'}
      try{const meta=await readExif(file),names=['camera','lens','focal_length','aperture','shutter_speed','iso','taken_at'];let loaded=0;for(const name of names){const el=uploadForm.elements.namedItem(name),value=meta?.[name];if(el&&value){el.value=value;loaded++}}if(document.querySelector('#circa'))document.querySelector('#circa').checked=false;if(status){status.textContent=loaded?`EXIF loaded · ${loaded} fields`:'No readable EXIF metadata found';status.className=loaded?'status ok':'status'}}catch(err){if(status){status.textContent='Could not read EXIF metadata';status.className='status bad'}}
    });
    uploadForm?.addEventListener('submit',()=>{const d=uploadForm.querySelector('[name="taken_at"]');if(d&&document.querySelector('#circa')?.checked&&d.value.trim()&&!/^c\.\s*/i.test(d.value))d.value='c. '+d.value.trim()},true);
    document.addEventListener('click',e=>{const b=e.target.closest('[data-action="edit"]');if(!b)return;const id=Number(b.dataset.id);setTimeout(async()=>{const fields=document.querySelector('#modalFields');if(!id||!fields)return;try{const r=await fetch(`/api/admin/media/${id}?exif=1`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const blob=await r.blob(),file=new File([blob],'photo.jpg',{type:blob.type||'image/jpeg'}),meta=await readExif(file),names=['camera','lens','focal_length','aperture','shutter_speed','iso'];let loaded=0;for(const name of names){const el=fields.querySelector(`[data-f="${name}"]`),value=meta?.[name];if(el&&value){el.value=value;loaded++}}if(loaded){const s=document.querySelector(`#replace-status-${id}`);if(s){s.textContent=`EXIF refreshed · ${loaded} fields — Save changes to keep it`;s.className='status ok'}}}catch{}},0)},true);
    document.addEventListener('click',async e=>{const b=e.target.closest('[data-modal-action="save"]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();const id=Number(b.dataset.id),fields=document.querySelector('#modalFields');if(!id||!fields)return;const d={};fields.querySelectorAll('[data-f]').forEach(el=>d[el.dataset.f]=el.type==='checkbox'?el.checked:el.value);d.category=(d.archived?'archive/':'')+String(d.category||'other').replace(/^archive\//,'');delete d.archived;d.taken_at=String(d.taken_at||'').trim().replace(/^c\.\s*/i,'');if(document.querySelector('#modalCirca')?.checked&&d.taken_at)d.taken_at='c. '+d.taken_at;b.disabled=true;b.textContent='Saving…';try{await patchPhoto(id,d);closeModal();await load()}catch(err){b.disabled=false;b.textContent='Save changes';const s=document.querySelector('#manageStatus');if(s){s.textContent=err.message||'Save failed';s.className='status bad'}}},true);
  }catch(err){console.error(err);const h=document.querySelector('h1');if(h){const e=document.createElement('p');e.className='status bad';e.textContent='Admin failed to start: '+err.message;h.insertAdjacentElement('afterend',e);}}
})();
