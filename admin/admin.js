// Admin frontend logic. Requires session auth token set by login.html
(function(){
  if (!sessionStorage.getItem('adminAuth')){ window.location.href='login.html'; return }
  document.getElementById('logout').addEventListener('click', function(e){ e.preventDefault(); sessionStorage.removeItem('adminAuth'); sessionStorage.removeItem('adminUser'); window.location.href='login.html'; });

  // Theme toggle (dark / light) persisted in localStorage
  const themeToggle = document.getElementById('theme-toggle');
  function applyTheme(t){
    if (t === 'dark') document.body.classList.add('dark'); else document.body.classList.remove('dark');
    if (themeToggle){
      themeToggle.setAttribute('aria-pressed', t === 'dark');
      themeToggle.querySelector('.small').textContent = t === 'dark' ? 'Dark' : 'Light';
      themeToggle.querySelector('.dot').style.background = t === 'dark' ? 'var(--accent-2)' : 'var(--accent)';
    }
  }
  const savedTheme = localStorage.getItem('adminTheme') || 'light';
  applyTheme(savedTheme);
  if (themeToggle){
    themeToggle.addEventListener('click', function(){
      const now = document.body.classList.contains('dark') ? 'light' : 'dark';
      localStorage.setItem('adminTheme', now);
      applyTheme(now);
    });
  }

  // Load vehicles by scraping stock.html's vehicle-grid
  async function loadVehicles(){
    try{
      const r = await fetch('../stock.html');
      const text = await r.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const cards = doc.querySelectorAll('.vehicle-card');
      const list = document.getElementById('vehicle-list');
      list.innerHTML='';
      cards.forEach(c=>{
        const title = c.querySelector('.vehicle-info h3')?.textContent || 'Untitled';
        const link = c.querySelector('.view-details')?.getAttribute('href') || '#';
        const li = document.createElement('li');
          li.innerHTML = `<strong>${title}</strong> <br/><a href="${link}" target="_blank">${link}</a> <div style="margin-top:.25rem"><button data-link="${link}" class="del">Delete</button> <button data-link="${link}" class="cmd">CLI</button> <button data-id="${link.replace('vehicle-','').replace('.html','')}" class="regen">Regenerate Thumbs</button></div>`;
        list.appendChild(li);
      });
      // wire actions
      list.querySelectorAll('.del').forEach(b=>b.addEventListener('click', e=>{ const href=e.target.dataset.link; const id = href.replace('vehicle-','').replace('.html',''); promptDelete(id); }));
      list.querySelectorAll('.cmd').forEach(b=>b.addEventListener('click', e=>{ const href=e.target.dataset.link; const id = href.replace('vehicle-','').replace('.html',''); showRemoveCmd(id); }));
      list.querySelectorAll('.regen').forEach(b=>b.addEventListener('click', async function(e){
        const id = e.target.dataset.id;
        const sizes = prompt('Enter sizes comma-separated (e.g. 800x600,400x300)', '800x600,400x300');
        if (sizes === null) return;
        const pwd = prompt('Admin current password (required)');
        if (!pwd) { alert('Password required'); return }
        e.target.textContent = 'Regenerating...';
        try{
          const fd = new FormData(); fd.append('id', id); fd.append('sizes', sizes); fd.append('current_password', pwd);
          const r = await fetch('http://127.0.0.1:5001/admin/regenerate_thumbs', {method:'POST', body: fd});
          const j = await r.json();
          if (r.ok){ alert('Thumbs regenerated: ' + (j.written||[]).join(', ')); e.target.textContent='Regenerate Thumbs'; }
          else { alert('Error: ' + (j.error||r.statusText)); e.target.textContent='Regenerate Thumbs'; }
        }catch(err){ alert('Could not reach admin API'); e.target.textContent='Regenerate Thumbs'; }
      }));
    }catch(e){ console.error(e); document.getElementById('vehicle-list').textContent='Could not load vehicles'; }
  }

  function promptDelete(id){
    if (!confirm('This will remove vehicle-'+id+' and update stock/index. Run from repo root?')) return;
    const cmd = `python tools/remove_vehicle.py --id ${id}`;
    alert('Run this command in the repo root:\n\n'+cmd);
  }
  function showRemoveCmd(id){
    const el = document.getElementById('cli-cmd'); el.textContent = `python tools/remove_vehicle.py --id ${id}`;
  }

  // inquiries from localStorage
  function loadInquiries(){
    const arr = JSON.parse(localStorage.getItem('inquiries')||'[]').slice().reverse();
    const ul = document.getElementById('inquiry-list'); ul.innerHTML='';
    if (!arr.length) return ul.innerHTML='<li>No inquiries</li>';
    arr.forEach(i=>{ const li=document.createElement('li'); li.innerHTML = `<b>${i.name||'Unknown'}</b> — ${i.contact||'no contact'}<br/><small>${i.vehicle||''} • ${new Date(i.ts).toLocaleString()}</small><div style="margin-top:.25rem">${i.message?'<div>'+i.message+'</div>':''}</div>`; ul.appendChild(li); });
  }

  document.getElementById('add-vehicle').addEventListener('submit', function(e){ e.preventDefault(); const fd=new FormData(e.target); const id=fd.get('id').trim(); const title=fd.get('title'); const price=fd.get('price'); const year=fd.get('year'); if(!id||!title){ alert('id and title required'); return } const cmd = `python tools/generate_vehicle.py --id ${id} --title "${title}" --price "${price}" --year ${year} --images images/${id}/1.jpg`; document.getElementById('cli-cmd').textContent = cmd; });

  // Rotate credentials via local admin API
  const rotateForm = document.getElementById('rotate-creds');
  if (rotateForm){
    rotateForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData(e.target);
      const current = fd.get('current');
      const username = fd.get('username');
      const password = fd.get('password');
      const resEl = document.getElementById('rotate-result');
      resEl.textContent = 'Rotating...';
      try{
        const r = await fetch('http://127.0.0.1:5001/admin/rotate', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({current_password: current, new_username: username, new_password: password})});
        const j = await r.json();
        if (r.ok){ resEl.textContent = 'Credentials rotated. New user: '+j.creds.username + '. Update saved.'; }
        else { resEl.textContent = 'Error: '+(j.error||r.statusText); }
      }catch(err){ resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)'; }
    });
  }

  // Upload images form
  const uploadForm = document.getElementById('upload-images');
  if (uploadForm){
    uploadForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData();
      const id = uploadForm.querySelector('input[name="id"]').value.trim();
      const files = document.getElementById('files').files;
      if (!id){ alert('vehicle id required'); return }
      for(let i=0;i<files.length;i++) fd.append('files', files[i]);
      fd.append('id', id);
      const resEl = document.getElementById('upload-res'); resEl.textContent='Uploading...';
      try{
        const r = await fetch('http://127.0.0.1:5001/admin/upload', {method:'POST', body: fd});
        const j = await r.json();
        if (r.ok){ resEl.textContent = 'Uploaded: ' + (j.files||[]).join(', '); }
        else { resEl.textContent = 'Error: ' + (j.error||r.statusText); }
      }catch(err){ resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)'; }
    });
  }

  // Create vehicle (upload files and generate page)
  const createForm = document.getElementById('create-vehicle');
  if (createForm){
    createForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData();
      const fields = ['current_password','id','title','price','year','transmission','fuel','mileage','vin','history','location'];
      fields.forEach(k=>{ const el = createForm.querySelector('[name="'+k+'"]'); if(el && el.value) fd.append(k, el.value); });
      const files = document.getElementById('create-files').files;
      for(let i=0;i<files.length;i++) fd.append('files', files[i]);
      const resEl = document.getElementById('create-res'); resEl.textContent='Creating...';
      try{
        const r = await fetch('http://127.0.0.1:5001/admin/create_vehicle', {method:'POST', body: fd});
        const j = await r.json();
        if (r.ok){ resEl.textContent = j.output || 'Created'; loadVehicles(); }
        else { resEl.textContent = 'Error: ' + (j.error||r.statusText); }
      }catch(err){ resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)'; }
    });
  }

  loadVehicles(); loadInquiries();
})();
