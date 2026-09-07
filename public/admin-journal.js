(()=>{
  const $=s=>document.querySelector(s);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let entries=[];

  async function request(url,options={}){
    const r=await fetch(url,{cache:'no-store',...options});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||`Request failed (${r.status})`);
    return d;
  }

  function render(){
    const filter=$('#journalFilter').value;
    const list=entries.filter(e=>filter==='all'||e.visibility===filter);
    $('#journalList').innerHTML=list.length?list.map(e=>`<article class="entryCard" data-id="${e.id}">
      <div class="badges"><span class="badge">${esc(e.visibility)}</span>${e.entry_date?`<span class="badge">${esc(e.entry_date)}</span>`:''}<span class="badge">${e.images?.length||0} photo${e.images?.length===1?'':'s'}</span></div>
      <h3>${esc(e.title)}</h3>
      ${e.subtitle?`<p class="meta">${esc(e.subtitle)}</p>`:''}
      <div class="actions"><a class="secondary" href="/journal?entry=${encodeURIComponent(e.slug)}" target="_blank">Preview</a><button class="secondary" data-edit="${e.id}" type="button">Edit</button><button class="danger" data-delete="${e.id}" type="button">Delete</button></div>
      <div class="edit hidden" id="edit-${e.id}">
        <div class="row"><div><label>Title</label><input data-f="title" value="${esc(e.title)}"></div><div><label>Date</label><input data-f="entry_date" type="date" value="${esc(e.entry_date||'')}"></div></div>
        <label>Subtitle</label><input data-f="subtitle" value="${esc(e.subtitle||'')}">
        <div class="row"><div><label>Location</label><input data-f="location" value="${esc(e.location||'')}"></div><div><label>Visibility</label><select data-f="visibility"><option value="draft" ${e.visibility==='draft'?'selected':''}>Draft</option><option value="private" ${e.visibility==='private'?'selected':''}>Private</option><option value="public" ${e.visibility==='public'?'selected':''}>Public</option></select></div></div>
        <div class="row"><div><label>Camera</label><input data-f="camera" value="${esc(e.camera||'')}"></div><div><label>Lens</label><input data-f="lens" value="${esc(e.lens||'')}"></div></div>
        <label>Journal text</label><textarea data-f="body">${esc(e.body||'')}</textarea>
        <label>Add photographs</label><input type="file" data-images accept="image/jpeg,image/png,image/webp" multiple>
        <div class="actions"><button data-save="${e.id}" type="button">Save changes</button><button class="secondary" data-add-images="${e.id}" type="button">Upload added photos</button></div>
        <div class="status" data-status></div>
      </div>
    </article>`).join(''):'<div class="empty">No journal entries in this view yet.</div>';
  }

  async function load(){
    const d=await request('/api/admin/journal');entries=d.entries||[];render();
  }

  $('#journalForm').addEventListener('submit',async ev=>{
    ev.preventDefault();const form=ev.currentTarget,status=$('#journalStatus'),button=form.querySelector('button[type="submit"]');
    status.textContent='Creating entry…';status.className='status';button.disabled=true;
    try{
      const f=new FormData(form);
      await request('/api/admin/journal',{method:'POST',body:f});
      form.reset();status.textContent='Entry created ✓';status.className='status ok';await load();
    }catch(err){status.textContent=err.message;status.className='status bad'}finally{button.disabled=false}
  });

  $('#journalFilter').addEventListener('change',render);
  $('#journalList').addEventListener('click',async ev=>{
    const edit=ev.target.closest('[data-edit]');if(edit){$('#edit-'+edit.dataset.edit)?.classList.toggle('hidden');return}
    const del=ev.target.closest('[data-delete]');if(del){if(!confirm('Delete this journal entry and its photographs?'))return;try{await request('/api/admin/journal/'+del.dataset.delete,{method:'DELETE'});await load()}catch(err){alert(err.message)}return}
    const save=ev.target.closest('[data-save]');if(save){
      const card=save.closest('.entryCard'),box=card.querySelector('.edit'),status=box.querySelector('[data-status]'),data={};box.querySelectorAll('[data-f]').forEach(x=>data[x.dataset.f]=x.value);save.disabled=true;status.textContent='Saving…';
      try{await request('/api/admin/journal/'+save.dataset.save,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(data)});status.textContent='Saved ✓';status.className='status ok';await load()}catch(err){status.textContent=err.message;status.className='status bad';save.disabled=false}
      return;
    }
    const add=ev.target.closest('[data-add-images]');if(add){
      const box=add.closest('.edit'),input=box.querySelector('[data-images]'),status=box.querySelector('[data-status]');if(!input.files?.length){status.textContent='Choose one or more photographs first.';status.className='status bad';return}
      const f=new FormData();for(const file of input.files)f.append('images',file);add.disabled=true;status.textContent='Uploading photographs…';status.className='status';
      try{const d=await request('/api/admin/journal/'+add.dataset.addImages+'/images',{method:'POST',body:f});status.textContent=`Added ${d.count} photo${d.count===1?'':'s'} ✓`;status.className='status ok';await load()}catch(err){status.textContent=err.message;status.className='status bad';add.disabled=false}
    }
  });

  load().catch(err=>{$('#journalList').innerHTML=`<div class="status bad">${esc(err.message)}</div>`});
})();
