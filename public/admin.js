// Admin v0.8.4 archive-flag loader.
(async()=>{
  try{
    const r=await fetch('/admin-core.js?v=0.8.3',{cache:'no-store'});
    if(!r.ok) throw new Error(`Admin core failed to load (${r.status})`);
    let code=await r.text();
    const rep=(a,b)=>{if(!code.includes(a))throw new Error('Archive patch marker missing');code=code.replace(a,b)};
    rep('\n}\nfunction visibleItems','\nfunction visibleItems');
    rep("const ADMIN_VERSION='0.8.2';","const ADMIN_VERSION='0.8.4';");
    rep("cats=['wildlife','architecture','landscape','other','archive'];","cats=['wildlife','architecture','landscape','other'];");
    rep("all=d.photos||[];","all=(d.photos||[]).map(p=>({...p,archived:String(p.category||'').startsWith('archive/'),category:String(p.category||'').replace(/^archive\\//,'')}));");
    rep("${p.featured?'<span class=\"badge\">Featured</span>':''}","${p.featured?'<span class=\"badge\">Featured</span>':''}${p.archived?'<span class=\"badge\">Archive</span>':''}");
    rep("<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div></div>","<div class=\"check\"><input data-f=\"featured\" type=\"checkbox\" ${p.featured?'checked':''}><label>Featured</label></div><div class=\"check\"><input data-f=\"archived\" type=\"checkbox\" ${p.archived?'checked':''}><label>Archive</label></div></div>");
    rep("f.set('featured',$('#featured').checked?'true':'false');","f.set('featured',$('#featured').checked?'true':'false');if($('#archived')?.checked)f.set('category','archive/'+f.get('category'));");
    rep("f.set('web',x.file);f.set('published',$('#batchPublished').value);","f.set('web',x.file);if(x.archived)f.set('category','archive/'+x.category);f.set('published',$('#batchPublished').value);");
    rep("iso:'',status:''}","iso:'',archived:false,status:''}");
    rep("<div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">","<div class=\"check\" style=\"margin:12px 0\"><input type=\"checkbox\" data-i=\"${i}\" data-f=\"archived\" ${x.archived?'checked':''}><label>Archive</label></div><div class=\"status ${x.status==='Uploaded ✓'?'ok':x.status?'bad':''}\">");
    rep("batch[i][e.target.dataset.f]=e.target.value","batch[i][e.target.dataset.f]=e.target.type==='checkbox'?e.target.checked:e.target.value");
    rep("const d={};$$('[data-f]',$('#modalFields')).forEach(el=>d[el.dataset.f]=el.type==='checkbox'?el.checked:el.value);await patchPhoto(id,d);","const d={};$$('[data-f]',$('#modalFields')).forEach(el=>d[el.dataset.f]=el.type==='checkbox'?el.checked:el.value);d.category=(d.archived?'archive/':'')+d.category;delete d.archived;await patchPhoto(id,d);");
    (0,eval)(code);
    const checks=document.querySelector('#uploadForm .checks');
    if(checks&&!document.querySelector('#archived'))checks.insertAdjacentHTML('beforeend','<div class="check"><input id="archived" type="checkbox"><label>Archive</label></div>');
  }catch(err){
    console.error(err);
    const h=document.querySelector('h1');
    if(h){const e=document.createElement('p');e.className='status bad';e.textContent='Admin failed to start: '+err.message;h.insertAdjacentElement('afterend',e);}
  }
})();
