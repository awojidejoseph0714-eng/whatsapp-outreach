const DEFAULT_TEMPLATE = `Happy New Month, {first_name}. This is Adura from Futapreneurs. How have you been? I have four questions and a good news for you. [1] What's the update about your entrepreneurial journey so far? [2] is there anything you'd love to share regarding your personal and business growth since the beginning of the year till today? [3] Do you have any comment, suggestion and/or advice regarding futapreneurs, of the moment.        Unto, my good news,  I'm also happy to tell you, if you did not know that the Futapreneurs summit is coming up on the 24th of this month from 10am till the evening, at the Obafemi Awolowo Auditorium. The theme is Marketing, Sales and Money. We are gathering to connect with each other, and to learn from Top Experts in the field of Marketing, Sales and Our Finances. Over 120 people are registered, and vendors are plenty (those guys are going to be showing their business to hundreds of entreprenuers across FUTA), if you want to be part of them, you can do well to register as a vendor (there's only 24 spots left). I'd love to see you at the Summit. Let's I forget, don't forget to dress well, and carry your networking superpower when you're coming for the summit. Last Question [4] Are you registered for the summit?`;

const CONTACTS_KEY = 'wa-outreach-contacts';
const PROGRESS_KEY = 'wa-outreach-progress';
const TEMPLATE_KEY = 'wa-outreach-template';

let contacts = [];   
let sentSet = new Set();
let lastSentKey = null; // for global undo

const uploadCard = document.getElementById('uploadCard');
const mainCard = document.getElementById('mainCard');
const uploadError = document.getElementById('uploadError');
const tableBody = document.getElementById('tableBody');
const searchBox = document.getElementById('searchBox');
const pendingOnly = document.getElementById('pendingOnly');
const emptyState = document.getElementById('emptyState');
const templateInput = document.getElementById('templateInput');
const nextPendingBtn = document.getElementById('nextPendingBtn');
const undoGlobalBtn = document.getElementById('undoGlobalBtn');

const statTotal = document.getElementById('statTotal');
const statSent = document.getElementById('statSent');
const statPending = document.getElementById('statPending');
const progressFill = document.getElementById('progressFill');

// ---------- CSV parsing ----------
function parseCSV(text){
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQuotes){
      if(c === '"'){
        if(text[i+1] === '"'){ field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if(c === '"') inQuotes = true;
      else if(c === ','){ row.push(field); field=''; }
      else if(c === '\n' || c === '\r'){
        if(c === '\r' && text[i+1] === '\n') i++;
        row.push(field); field='';
        rows.push(row); row=[];
      } else field += c;
    }
  }
  if(field.length || row.length){ row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function normalizePhone(raw){
  let p = (raw || '').replace(/[^\d+]/g,'');
  if(p.startsWith('+')) p = p.slice(1);
  if(p.startsWith('0')) p = '234' + p.slice(1);
  else if(p.length === 10) p = '234' + p;
  return p;
}

function buildContacts(rows){
  const header = rows[0].map(h => h.trim().toLowerCase());
  
  // Flexible matching
  let nameIdx = header.findIndex(h => h.includes('name'));
  let phoneIdx = header.findIndex(h => h.includes('phone') || h.includes('number') || h.includes('contact'));
  let stageIdx = header.findIndex(h => h.includes('stage') || h.includes('level'));

  // Fallback to first two columns if strict matching fails
  if (nameIdx === -1) nameIdx = 0;
  if (phoneIdx === -1 && header.length > 1) phoneIdx = 1;

  const out = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    const name = (r[nameIdx] || '').trim();
    const rawPhone = (r[phoneIdx] || '').trim();
    const stage = stageIdx !== -1 && stageIdx < r.length ? (r[stageIdx] || '').trim() : '';
    
    if(!name && !rawPhone) continue;
    
    const phone = normalizePhone(rawPhone);
    const firstName = name.split(/\s+/)[0] || name;
    const valid = /^234\d{10}$/.test(phone) || (phone.length >= 11 && phone.length <= 13);
    out.push({ name, phone, stage, firstName, valid });
  }
  return out;
}

// ---------- Storage ----------
async function loadFromStorage(){
  try {
    if(window.storage) {
        const c = await window.storage.get(CONTACTS_KEY, false);
        if(c && c.value) contacts = JSON.parse(c.value);
        const p = await window.storage.get(PROGRESS_KEY, false);
        if(p && p.value) sentSet = new Set(JSON.parse(p.value));
        const t = await window.storage.get(TEMPLATE_KEY, false);
        templateInput.value = (t && t.value) ? t.value : DEFAULT_TEMPLATE;
    } else {
        const c = localStorage.getItem(CONTACTS_KEY);
        if(c) contacts = JSON.parse(c);
        const p = localStorage.getItem(PROGRESS_KEY);
        if(p) sentSet = new Set(JSON.parse(p));
        const t = localStorage.getItem(TEMPLATE_KEY);
        templateInput.value = t || DEFAULT_TEMPLATE;
    }
  } catch(e){
    contacts = [];
    sentSet = new Set();
    templateInput.value = DEFAULT_TEMPLATE;
  }
}

async function saveStorageData(key, value){
  try {
    if(window.storage) await window.storage.set(key, value, false);
    else localStorage.setItem(key, value);
  } catch(e){ console.error('Save failed', e); }
}

async function saveContacts() { await saveStorageData(CONTACTS_KEY, JSON.stringify(contacts)); }
async function saveProgress() { await saveStorageData(PROGRESS_KEY, JSON.stringify([...sentSet])); }
async function saveTemplate() { await saveStorageData(TEMPLATE_KEY, templateInput.value); }

templateInput.addEventListener('input', () => {
    saveTemplate();
    render(); // Re-render links immediately
});

// ---------- Rendering ----------
function generateMessage(c) {
    let tpl = templateInput.value;
    tpl = tpl.replace(/{name}/g, c.name);
    tpl = tpl.replace(/{first_name}/g, c.firstName);
    tpl = tpl.replace(/{phone}/g, c.phone);
    return tpl;
}

function render(){
  const q = searchBox.value.trim().toLowerCase();
  const onlyPending = pendingOnly.checked;

  tableBody.innerHTML = '';
  let shown = 0;
  let nextPendingIndex = -1;

  contacts.forEach((c, idx) => {
    const key = c.phone + '|' + idx;
    const isSent = sentSet.has(key);
    
    if(!isSent && nextPendingIndex === -1 && c.valid) {
        nextPendingIndex = idx;
    }

    if(onlyPending && isSent) return;
    if(q && !(c.name.toLowerCase().includes(q) || c.phone.includes(q))) return;
    shown++;

    const tr = document.createElement('tr');
    if(isSent) tr.className = 'sent';

    const message = generateMessage(c);
    const link = `https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`;

    tr.innerHTML = `
      <td class="name-cell">${escapeHtml(c.name)}</td>
      <td class="phone-cell">${c.valid ? escapeHtml(c.phone) : `<span class="invalid">${escapeHtml(c.phone || '—')} (check)</span>`}</td>
      <td>${c.stage ? `<span class="stage-badge">${escapeHtml(c.stage)}</span>` : ''}</td>
      <td>${isSent ? '<span class="sent-tag">✓ Sent</span>' : ''}</td>
      <td>
        <div style="display:flex;gap:6px;">
            <a class="btn btn-primary small" href="${link}" target="_blank" rel="noopener" data-idx="${idx}">Open chat</a>
            <button class="btn btn-ghost small" data-toggle="${idx}">${isSent ? 'Undo' : 'Mark sent'}</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  emptyState.style.display = shown === 0 ? 'block' : 'none';

  // Stats
  const total = contacts.length;
  const sentCount = sentSet.size;
  const pendingCount = total - sentCount;
  
  statTotal.textContent = total;
  statSent.textContent = sentCount;
  statPending.textContent = pendingCount;
  
  progressFill.style.width = total ? `${(sentCount/total*100)}%` : '0%';

  // Next Pending Button state
  if (nextPendingIndex !== -1) {
      nextPendingBtn.disabled = false;
      nextPendingBtn.innerHTML = `<span class="icon">⚡</span> Message Next Pending (${escapeHtml(contacts[nextPendingIndex].firstName)})`;
      nextPendingBtn.onclick = () => {
          const c = contacts[nextPendingIndex];
          const key = c.phone + '|' + nextPendingIndex;
          
          // Open chat
          const message = generateMessage(c);
          window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`, '_blank');
          
          // Mark sent
          sentSet.add(key);
          lastSentKey = key;
          saveProgress();
          undoGlobalBtn.style.display = 'inline-flex';
          setTimeout(render, 150);
      };
  } else {
      nextPendingBtn.disabled = true;
      nextPendingBtn.innerHTML = `<span class="icon">🎉</span> All Done!`;
      nextPendingBtn.onclick = null;
  }
}

function escapeHtml(s){
  return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// Global Undo
undoGlobalBtn.addEventListener('click', () => {
    if(lastSentKey && sentSet.has(lastSentKey)) {
        sentSet.delete(lastSentKey);
        lastSentKey = null;
        saveProgress();
        undoGlobalBtn.style.display = 'none';
        render();
    }
});

tableBody.addEventListener('click', (e) => {
  const openLink = e.target.closest('a[data-idx]');
  if(openLink){
    const idx = openLink.getAttribute('data-idx');
    const c = contacts[idx];
    const key = c.phone + '|' + idx;
    sentSet.add(key);
    lastSentKey = key;
    undoGlobalBtn.style.display = 'inline-flex';
    saveProgress();
    setTimeout(render, 150);
    return;
  }
  const toggleBtn = e.target.closest('button[data-toggle]');
  if(toggleBtn){
    const idx = toggleBtn.getAttribute('data-toggle');
    const c = contacts[idx];
    const key = c.phone + '|' + idx;
    if(sentSet.has(key)) {
        sentSet.delete(key);
        if(lastSentKey === key) { lastSentKey = null; undoGlobalBtn.style.display = 'none'; }
    } else {
        sentSet.add(key);
        lastSentKey = key;
        undoGlobalBtn.style.display = 'inline-flex';
    }
    saveProgress();
    render();
  }
});

searchBox.addEventListener('input', render);
pendingOnly.addEventListener('change', render);

document.getElementById('resetBtn').addEventListener('click', async () => {
  if(!confirm('Clear sent/pending progress for all contacts? Your contact list stays.')) return;
  sentSet = new Set();
  lastSentKey = null;
  undoGlobalBtn.style.display = 'none';
  await saveProgress();
  render();
});

document.getElementById('newCsvBtn').addEventListener('click', async () => {
  if(!confirm('Upload a different CSV? This replaces the current contact list (progress will reset too).')) return;
  contacts = [];
  sentSet = new Set();
  lastSentKey = null;
  undoGlobalBtn.style.display = 'none';
  try {
    if(window.storage) {
        await window.storage.delete(CONTACTS_KEY, false);
        await window.storage.delete(PROGRESS_KEY, false);
    } else {
        localStorage.removeItem(CONTACTS_KEY);
        localStorage.removeItem(PROGRESS_KEY);
    }
  }catch(e){}
  mainCard.style.display = 'none';
  uploadCard.style.display = 'block';
});

// ---------- Upload handling ----------
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');

function handleFile(file){
  uploadError.textContent = '';
  const reader = new FileReader();
  reader.onload = async (e) => {
    try{
      const rows = parseCSV(e.target.result);
      if(rows.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
      contacts = buildContacts(rows);
      if(contacts.length === 0) throw new Error('No valid contact rows found.');
      sentSet = new Set();
      lastSentKey = null;
      undoGlobalBtn.style.display = 'none';
      await saveContacts();
      await saveProgress();
      uploadCard.style.display = 'none';
      mainCard.style.display = 'block';
      render();
    }catch(err){
      uploadError.textContent = err.message;
    }
  };
  reader.readAsText(file);
}

fileInput.addEventListener('change', () => { if(fileInput.files[0]) handleFile(fileInput.files[0]); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

// ---------- Init ----------
(async function init(){
  await loadFromStorage();
  if(contacts.length > 0){
    uploadCard.style.display = 'none';
    mainCard.style.display = 'block';
    render();
  }
})();
