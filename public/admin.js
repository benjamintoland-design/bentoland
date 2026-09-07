// Admin v0.8.3 hotfix loader.
// The v0.8.2 core is preserved verbatim; remove the single known stray brace before execution.
(async()=>{
  try{
    const r=await fetch('/admin-core.js?v=0.8.3',{cache:'no-store'});
    if(!r.ok) throw new Error(`Admin core failed to load (${r.status})`);
    let code=await r.text();
    const bad='\n}\nfunction visibleItems';
    if(!code.includes(bad)) throw new Error('Expected admin syntax marker not found');
    code=code.replace(bad,'\nfunction visibleItems');
    code=code.replace("const ADMIN_VERSION='0.8.2';","const ADMIN_VERSION='0.8.3';");
    (0,eval)(code);
  }catch(err){
    console.error(err);
    const h=document.querySelector('h1');
    if(h){const e=document.createElement('p');e.className='status bad';e.textContent='Admin failed to start: '+err.message;h.insertAdjacentElement('afterend',e);}
  }
})();
