// Admin v0.8.6 archive + circa loader.
(async()=>{
  try{
    const r=await fetch('/admin-core.js?v=0.8.6',{cache:'no-store'});
    if(!r.ok) throw new Error(`Admin core failed to load (${r.status})`);
    let code=await r.text();
    const rep=(a,b)=>{if(!code.includes(a))throw new Error('Admin patch marker missing');code=code.replace(a,b)};
    rep('\n}\nfunction visibleItems','\nfunction visibleItems');
    rep("const ADMIN_VERSION='0.8.2';","const ADMIN_VERSION='0.8.6';");
    rep("cats=['wildlife','architecture','landscape','other','archive'];","cats=['wildlife','architecture','landscape','other'];");
    rep("all=d.photos||[];","all=(d.photos||[]).map(p=>({...p,archived:String(p.category||'').startsWith('archive/'),category:String(p.category||'').replace(/^archive\\//,'')}));");
    rep("${p.featured?'<span class=\"badge\">Featured</span>':''}","${p.featured?'<span class=\"badge\">Featured</span>':''}${p.archived?'<span class=\"badge\">Archive</span>':''}");
    rep("<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div></div>","<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div><div class=\"check\"><input data-f=\"archived\" type=\"checkbox\" ${p.archived?'checked':''}><label>Archive</label></div></div>");
    rep("<input data-f=\"taken_at\" type=\"date\" value=\"${esc(fmtDate(p.taken_at))}\">","<input data-f=\"taken_at\" type=\"text\" inputmode=\"numeric\" placeholder=\"YYYY, YYYY-MM, or YYYY-MM-DD\" value=\"${esc(String(p.taken_at||'').replace(/^c\\.\\s*/i,''))}\"><div class=\"check\" style=\"margin-top:9px\"><input id=\"modalCirca\" type=\"checkbox\" ${/^c\\.\\s*/i.test(String(p.taken_at||''))?'checked':''}><label>Circa</label></div>");
    rep("f.set('featured',$('#featured').checked?'true':'false');","f.set('featured',$('#featured').checked?'true':'false');if($('#archived')?.checked)f.set('category','archive/'+f.get('category'));");
    rep("f.set('web',x.file);f.set('published',$('#batchPublished').value);","f.set('web',x.file);if(x.archived)f.set('category','archive/'+x.category);f.set('published',$('#batchPublished').value);");
    rep("iso:'',status:''}","iso:'',archived:false,status:''}");
    rep("<div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">","<div class=\"check\" style=\"margin:12px 0\"><input type=\"checkbox\" data-i=\"${i}\" data-f=\"archived\" ${x.archived?'checked':''}><label>Archive</label></div><div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">");
    rep("batch[i][e.target.dataset.f]=e.target.value","batch[i][e.target.dataset.f]=e.target.type==='checkbox'?e.target.checked:e.target.value");
    rep("await bulkPatch({category:e.target.value});e.target.value=''","const c=e.target.value;for(const id of [...selected]){const p=all.find(x=>x.id===id);await patchPhoto(id,{category:(p?.archived?'archive/':'')+c})}selected.clear();e.target.value='';await load()");
    (0,eval)(code);
    const checks=document.querySelector('#uploadForm .checks');
    if(checks&&!document.querySelector('#archived'))checks.insertAdjacentHTML('beforeend','<div class="check"><input id="archived" type="checkbox"><label>Archive</label></div>');
    const uploadDate=document.querySelector('#uploadForm [name="taken_at"]');
    if(uploadDate){uploadDate.type='text';uploadDate.inputMode='numeric';uploadDate.placeholder='YYYY, YYYY-MM, or YYYY-MM-DD';uploadDate.insertAdjacentHTML('afterend','<div class="check" style="margin-top:9px"><input id="circa" type="checkbox"><label>Circa</label></div>')}
    document.querySelector('#uploadForm')?.addEventListener('submit',()=>{const d=document.querySelector('#uploadForm [name="taken_at"]');if(d&&document.querySelector('#circa')?.checked&&d.value.trim()&&!/^c\.\s*/i.test(d.value))d.value='c. '+d.value.trim()},true);
    document.addEventListener('click',async e=>{
      const b=e.target.closest('[data-modal-action="save"]');
      if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();
      const id=Number(b.dataset.id),fields=document.querySelector('#modalFields');
      if(!id||!fields)return;
      const d={};fields.querySelectorAll('[data-f]').forEach(el=>d[el.dataset.f]=el.type==='checkbox'?el.checked:el.value);
      d.category=(d.archived?'archive/':'')+String(d.category||'other').replace(/^archive\//,'');delete d.archived;
      d.taken_at=String(d.taken_at||'').trim().replace(/^c\.\s*/i,'');if(document.querySelector('#modalCirca')?.checked&&d.taken_at)d.taken_at='c. '+d.taken_at;
      b.disabled=true;b.textContent='Saving…';
      try{await patchPhoto(id,d);closeModal();await load()}catch(err){b.disabled=false;b.textContent='Save changes';const s=document.querySelector('#manageStatus');if(s){s.textContent=err.message||'Save failed';s.className='status bad'}}
    },true);
  }catch(err){
    console.error(err);
    const h=document.querySelector('h1');
    if(h){const e=document.createElement('p');e.className='status bad';e.textContent='Admin failed to start: '+err.message;h.insertAdjacentElement('afterend',e);}
  }
})();
