(()=>{
  const fixSelect=select=>{
    if(!select)return;
    [...select.options].forEach(o=>{
      if(o.value==='wildlife'||o.textContent.trim().toLowerCase()==='wildlife'){
        o.value='animals';
        o.textContent='Animals';
      }
    });
  };
  const fix=()=>{
    document.querySelectorAll('select').forEach(fixSelect);
    document.querySelectorAll('[data-cat="wildlife"]').forEach(el=>{
      el.dataset.cat='animals';
      for(const n of el.childNodes){if(n.nodeType===Node.TEXT_NODE&&/wildlife/i.test(n.textContent))n.textContent=n.textContent.replace(/wildlife/ig,'Animals')}
    });
  };
  fix();
  new MutationObserver(fix).observe(document.documentElement,{childList:true,subtree:true});
})();
