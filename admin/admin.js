// Admin frontend logic. Requires session auth token set by login.html
(function(){
  const authKey = 'adminAuth';
  if (!sessionStorage.getItem(authKey)){
    window.location.href = 'login.html';
    return;
  }

  const logoutButton = document.getElementById('logout');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e){
      e.preventDefault();
      sessionStorage.removeItem(authKey);
      sessionStorage.removeItem('adminUser');
      window.location.href = 'login.html';
    });
  }

  const themeToggle = document.getElementById('theme-toggle');
  function applyTheme(theme){
    if (theme === 'dark') document.body.classList.add('dark');
    else document.body.classList.remove('dark');

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', theme === 'dark');
      const small = themeToggle.querySelector('.small');
      if (small) small.textContent = theme === 'dark' ? 'Dark' : 'Light';
      const dot = themeToggle.querySelector('.dot');
      if (dot) dot.style.background = theme === 'dark' ? 'var(--accent-dark)' : 'var(--accent)';
    }
  }

  const savedTheme = localStorage.getItem('adminTheme') || 'light';
  applyTheme(savedTheme);

  if (themeToggle) {
    themeToggle.addEventListener('click', function(){
      const next = document.body.classList.contains('dark') ? 'light' : 'dark';
      localStorage.setItem('adminTheme', next);
      applyTheme(next);
    });
  }

  function guessVehicleImage(href){
    const slug = href
      .replace(/^.*?vehicle-/, '')
      .replace(/\.html$/, '')
      .trim();

    if (!slug || slug === '#' || slug === 'undefined') return '../images/placeholder-car.svg';

    const candidates = [
      `../images/${slug}/1.jpg`,
      `../images/${slug}/thumb.jpg`,
      `../images/${slug}/cover.jpg`,
      `../images/${slug}/2.jpg`,
      `../images/${slug}/main.jpg`
    ];

    return candidates[0];
  }

  async function loadVehicles(){
    const list = document.getElementById('vehicle-list');
    const countEl = document.getElementById('stat-vehicles');

    try {
      const r = await fetch('../stock.html');
      const text = await r.text();
      const doc = new DOMParser().parseFromString(text, 'text/html');
      const cards = Array.from(doc.querySelectorAll('.vehicle-card'));

      if (countEl) countEl.textContent = String(cards.length);
      if (!list) return;

      list.innerHTML = '';
      if (!cards.length) {
        list.innerHTML = '<li>No vehicles yet.</li>';
        return;
      }

      cards.forEach(card => {
        const title = card.querySelector('.vehicle-info h3')?.textContent || 'Untitled';
        const link = card.querySelector('.view-details')?.getAttribute('href') || '#';
        const imageSrc = guessVehicleImage(link);
        const item = document.createElement('li');
        item.innerHTML = `
          <div class="vehicle-list-row">
            <img class="vehicle-thumbnail" src="${imageSrc}" alt="${title}" onerror="this.onerror=null;this.src='../images/placeholder-car.svg';" />
            <div class="vehicle-list-meta">
              <strong>${title}</strong>
              <a href="${link}" target="_blank">Open page</a>
            </div>
          </div>
          <div class="mini-actions">
            <button data-link="${link}" class="mini-btn del">Delete</button>
            <button data-link="${link}" class="mini-btn cmd">CLI</button>
            <button data-id="${link.replace('vehicle-','').replace('.html','')}" class="mini-btn regen">Thumbs</button>
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('.del').forEach(button => button.addEventListener('click', e => {
        const href = e.target.dataset.link;
        const id = href.replace('vehicle-','').replace('.html','');
        promptDelete(id);
      }));

      list.querySelectorAll('.cmd').forEach(button => button.addEventListener('click', e => {
        const href = e.target.dataset.link;
        const id = href.replace('vehicle-','').replace('.html','');
        showRemoveCmd(id);
      }));

      list.querySelectorAll('.regen').forEach(button => button.addEventListener('click', async function(e){
        const id = e.target.dataset.id;
        const sizes = prompt('Enter sizes comma-separated (e.g. 800x600,400x300)', '800x600,400x300');
        if (sizes === null) return;
        const pwd = prompt('Admin current password (required)');
        if (!pwd) { alert('Password required'); return; }

        e.target.textContent = 'Working...';
        try {
          const fd = new FormData();
          fd.append('id', id);
          fd.append('sizes', sizes);
          fd.append('current_password', pwd);

          const r = await fetch('http://127.0.0.1:5001/admin/regenerate_thumbs', { method: 'POST', body: fd });
          const j = await r.json();

          if (r.ok) {
            alert('Thumbs regenerated: ' + (j.written || []).join(', '));
          } else {
            alert('Error: ' + (j.error || r.statusText));
          }
        } catch (err) {
          alert('Could not reach admin API');
        } finally {
          e.target.textContent = 'Thumbs';
        }
      }));
    } catch (error) {
      console.error(error);
      if (list) list.innerHTML = '<li>Could not load vehicles.</li>';
    }
  }

  function promptDelete(id){
    if (!confirm('This will remove vehicle-' + id + ' and update stock/index. Run from repo root?')) return;
    const cmd = 'python tools/remove_vehicle.py --id ' + id;
    alert('Run this command in the repo root:\n\n' + cmd);
  }

  function showRemoveCmd(id){
    const el = document.getElementById('cli-cmd');
    if (el) el.textContent = 'python tools/remove_vehicle.py --id ' + id;
  }

  async function readInquiries(){
    const supabaseApi = window.KingdomSupabase;
    if (supabaseApi && supabaseApi.isConfigured) {
      try {
        const rows = await supabaseApi.loadInquiries();
        if (Array.isArray(rows)) return rows;
      } catch (error) {
        console.warn('Supabase inquiry fetch failed:', error);
      }
    }

    try {
      return JSON.parse(localStorage.getItem('inquiries') || '[]');
    } catch (error) {
      return [];
    }
  }

  async function saveInquiries(arr){
    const supabaseApi = window.KingdomSupabase;
    if (supabaseApi && supabaseApi.isConfigured) {
      await supabaseApi.syncInquiryList(arr);
      return;
    }

    localStorage.setItem('inquiries', JSON.stringify(arr));
  }

  function buildReplyBody(item, message){
    const name = item.name || 'Customer';
    const vehicle = item.vehicle || 'your selected vehicle';
    const channel = (item.contact || '').trim();
    return {
      subject: 'Re: Your inquiry about ' + vehicle,
      body: `Hello ${name},\n\nThank you for your interest in ${vehicle}.\n\n${message}\n\nKind regards,\nKingdom AutoMobile\nwww.kingdomautomobile.com`,
      mailto: channel.includes('@')
        ? `mailto:${channel}?subject=${encodeURIComponent('Re: Your inquiry about ' + vehicle)}&body=${encodeURIComponent(`Hello ${name},\n\nThank you for your interest in ${vehicle}.\n\n${message}\n\nKind regards,\nKingdom AutoMobile\nwww.kingdomautomobile.com`)}`
        : '',
      sms: channel && !channel.includes('@')
        ? `sms:${channel.replace(/\D/g, '')}`
        : ''
    };
  }

  function normalizeMessageThread(item){
    const initial = item.message || '';
    const history = Array.isArray(item.history) ? item.history : [];
    if (!history.length && initial) {
      return [{ role: 'customer', text: initial, ts: item.ts || Date.now() }];
    }
    return history;
  }

  async function sendReply(item, message){
    const trimmed = (message || '').trim();
    if (!trimmed) {
      alert('Write a reply before sending it.');
      return;
    }

    const arr = await readInquiries();
    const updated = arr.map(entry => {
      const match = entry.ts === item.ts && entry.contact === item.contact && entry.name === item.name && entry.vehicle === item.vehicle;
      if (!match) return entry;

      const history = normalizeMessageThread(entry);
      history.push({ role: 'admin', text: trimmed, ts: Date.now() });

      return {
        ...entry,
        reply: trimmed,
        status: 'sent',
        replySentAt: new Date().toISOString(),
        history
      };
    });
    await saveInquiries(updated);

    const { mailto, sms } = buildReplyBody(item, trimmed);
    const target = item.contact && item.contact.includes('@') ? mailto : sms;

    if (target) {
      window.location.href = target;
    }

    await loadInquiries();
    alert('Customer reply saved and marked as sent.');
  }

  async function loadInquiries(){
    const ul = document.getElementById('inquiry-list');
    const countEl = document.getElementById('stat-inquiries');
    if (!ul) return;

    const arr = (await readInquiries()).slice().reverse();
    if (countEl) countEl.textContent = String(arr.length);
    ul.innerHTML = '';

    if (!arr.length) {
      ul.innerHTML = '<li>No inquiries yet.</li>';
      return;
    }

    arr.forEach(item => {
      const li = document.createElement('li');
      const contact = item.contact || 'No contact';
      const vehicle = item.vehicle || 'Vehicle inquiry';
      const thread = normalizeMessageThread(item);
      const status = item.status === 'sent' || item.reply ? 'Sent' : 'Pending';
      const replyText = item.reply || 'Thank you for your interest in ' + vehicle + '. We would be happy to help with this vehicle.';

      const threadHtml = thread.map(entry => `
        <div class="thread-entry ${entry.role === 'admin' ? 'admin' : 'customer'}">
          <strong>${entry.role === 'admin' ? 'Kingdom' : (item.name || 'Customer')}</strong>
          <p>${(entry.text || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
          <small>${new Date(entry.ts).toLocaleString()}</small>
        </div>
      `).join('');

      li.innerHTML = `
        <div class="inquiry-header">
          <div>
            <strong>${item.name || 'Unknown'}</strong><br />
            <small>${contact} • ${vehicle}</small>
          </div>
          <span class="status-badge ${status === 'Sent' ? 'sent' : 'pending'}">${status}</span>
        </div>
        <div class="inquiry-message">${item.message || ''}</div>
        <div class="thread">
          ${threadHtml}
        </div>
        <small>${new Date(item.ts).toLocaleString()}</small>
        <div class="inquiry-panel">
          <div class="reply-box ${item.reply ? 'open' : ''}">
            <textarea class="reply-text">${replyText}</textarea>
            <div class="reply-actions">
              <button type="button" class="send-reply-btn">Send reply</button>
              <button type="button" class="close-reply-btn">Close</button>
            </div>
          </div>
          <div class="reply-actions">
            <button type="button" class="reply-btn">Reply</button>
          </div>
        </div>
      `;

      const replyBox = li.querySelector('.reply-box');
      const replyBtn = li.querySelector('.reply-btn');
      const closeBtn = li.querySelector('.close-reply-btn');
      const sendBtn = li.querySelector('.send-reply-btn');
      const textarea = li.querySelector('.reply-text');

      replyBtn.addEventListener('click', () => {
        replyBox.classList.toggle('open');
      });

      closeBtn.addEventListener('click', () => {
        replyBox.classList.remove('open');
      });

      sendBtn.addEventListener('click', () => {
        sendReply(item, textarea.value);
      });

      ul.appendChild(li);
    });
  }

  const addVehicle = document.getElementById('add-vehicle');
  if (addVehicle) {
    addVehicle.addEventListener('submit', function(e){
      e.preventDefault();
      const fd = new FormData(e.target);
      const id = fd.get('id').toString().trim();
      const title = fd.get('title');
      const price = fd.get('price');
      const year = fd.get('year');

      if (!id || !title) {
        alert('ID and title are required');
        return;
      }

      const cmd = `python tools/generate_vehicle.py --id ${id} --title "${title}" --price "${price}" --year ${year || ''} --images images/${id}/1.jpg`;
      const codeBox = document.getElementById('cli-cmd');
      if (codeBox) codeBox.textContent = cmd;
    });
  }

  const rotateForm = document.getElementById('rotate-creds');
  if (rotateForm) {
    rotateForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData(e.target);
      const current = fd.get('current');
      const username = fd.get('username');
      const password = fd.get('password');
      const resEl = document.getElementById('rotate-result');

      if (resEl) resEl.textContent = 'Rotating...';
      try {
        const r = await fetch('http://127.0.0.1:5001/admin/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: current, new_username: username, new_password: password })
        });
        const j = await r.json();
        if (r.ok) {
          if (resEl) resEl.textContent = 'Credentials rotated. New user: ' + j.creds.username + '. Update saved.';
        } else {
          if (resEl) resEl.textContent = 'Error: ' + (j.error || r.statusText);
        }
      } catch (err) {
        if (resEl) resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)';
      }
    });
  }

  const uploadForm = document.getElementById('upload-images');
  if (uploadForm) {
    uploadForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData();
      const id = uploadForm.querySelector('input[name="id"]').value.trim();
      const files = document.getElementById('files').files;

      if (!id) {
        alert('Vehicle ID is required');
        return;
      }

      for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
      fd.append('id', id);

      const resEl = document.getElementById('upload-res');
      if (resEl) resEl.textContent = 'Uploading...';

      try {
        const r = await fetch('http://127.0.0.1:5001/admin/upload', { method: 'POST', body: fd });
        const j = await r.json();
        if (r.ok) {
          if (resEl) resEl.textContent = 'Uploaded: ' + (j.files || []).join(', ');
        } else {
          if (resEl) resEl.textContent = 'Error: ' + (j.error || r.statusText);
        }
      } catch (err) {
        if (resEl) resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)';
      }
    });
  }

  const createForm = document.getElementById('create-vehicle');
  if (createForm) {
    createForm.addEventListener('submit', async function(e){
      e.preventDefault();
      const fd = new FormData();
      const fields = ['current_password', 'id', 'title', 'price', 'year', 'transmission', 'fuel', 'mileage', 'vin', 'history', 'location'];

      fields.forEach(key => {
        const field = createForm.querySelector('[name="' + key + '"]');
        if (field && field.value) fd.append(key, field.value);
      });

      const files = document.getElementById('create-files').files;
      for (let i = 0; i < files.length; i++) fd.append('files', files[i]);

      const resEl = document.getElementById('create-res');
      if (resEl) resEl.textContent = 'Creating...';

      try {
        const r = await fetch('http://127.0.0.1:5001/admin/create_vehicle', { method: 'POST', body: fd });
        const j = await r.json();
        if (r.ok) {
          if (resEl) resEl.textContent = j.output || 'Created';
          loadVehicles();
        } else {
          if (resEl) resEl.textContent = 'Error: ' + (j.error || r.statusText);
        }
      } catch (err) {
        if (resEl) resEl.textContent = 'Could not reach admin API (start tools/admin_api.py)';
      }
    });
  }

  loadVehicles();
  loadInquiries();
})();
