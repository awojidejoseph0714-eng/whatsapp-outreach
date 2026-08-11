const MESSAGE_TEMPLATE = `Happy New Month, {first_name}. This is Adura from Futapreneurs. How have you been? I have four questions and a good news for you. [1] What's the update about your entrepreneurial journey so far? [2] is there anything you'd love to share regarding your personal and business growth since the beginning of the year till today? [3] Do you have any comment, suggestion and/or advice regarding futapreneurs, of the moment.        Unto, my good news,  I'm also happy to tell you, if you did not know that the Futapreneurs summit is coming up on the 24th of this month from 10am till the evening, at the Obafemi Awolowo Auditorium. The theme is Marketing, Sales and Money. We are gathering to connect with each other, and to learn from Top Experts in the field of Marketing, Sales and Our Finances. Over 120 people are registered, and vendors are plenty (those guys are going to be showing their business to hundreds of entreprenuers across FUTA), if you want to be part of them, you can do well to register as a vendor (there's only 24 spots left). I'd love to see you at the Summit. Let's I forget, don't forget to dress well, and carry your networking superpower when you're coming for the summit. Last Question [4] Are you registered for the summit?`;

const CONTACTS_KEY = 'wa-outreach-contacts';
const PROGRESS_KEY = 'wa-outreach-progress';

let contacts = [];   // [{name, phone, stage, firstName, valid}]
let sentSet = new Set();

const uploadCard = document.getElementById('uploadCard');
const mainCard = document.getElementById('mainCard');
const uploadError = document.getElementById('uploadError');
const tableBody = document.getElementById('tableBody');
const searchBox = document.getElementById('searchBox');
const pendingOnly = document.getElementById('pendingOnly');
const emptyState = document.getElementById('emptyState');
const previewBox = document.getElementById('previewBox');

previewBox.textContent = MESSAGE_TEMPLATE.replace('{first_name}', 'Chidera');

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
  const nameIdx = header.findIndex(h => h.includes('name'));
  const phoneIdx = header.findIndex(h => h.includes('phone'));
  const stageIdx = header.findIndex(h => h.includes('stage'));
  if(nameIdx === -1 || phoneIdx === -1){
    throw new Error('Could not find "name" and "phone" columns in the header row.');
  }
  const out = [];
  for(let i=1;i<rows.length;i++){
    const r = rows[i];
    const name = (r[nameIdx] || '').trim();
    const rawPhone = (r[phoneIdx] || '').trim();
    const stage = stageIdx !== -1 ? (r[stageIdx] || '').trim() : '';
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
  try{
    const c = await window.storage.get(CONTACTS_KEY, false);
    if(c && c.value) contacts = JSON.parse(c.value);
  }catch(e){ contacts = []; }
  try{
    const p = await window.storage.get(PROGRESS_KEY, false);
    if(p && p.value) sentSet = new Set(JSON.parse(p.value));
  }catch(e){ sentSet = new Set(); }
}

async function saveContacts(){
  // fallback for localStorage if window.storage is unavailable
  try{ 
    if(window.storage) await window.storage.set(CONTACTS_KEY, JSON.stringify(contacts), false); 
    else localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
  }
  catch(e){ console.error('save contacts failed', e); }
}
async function saveProgress(){
  try{ 
    if(window.storage) await window.storage.set(PROGRESS_KEY, JSON.stringify([...sentSet]), false);
    else localStorage.setItem(PROGRESS_KEY, JSON.stringify([...sentSet]));
  }
  catch(e){ console.error('save progress failed', e); }
}

// Override loadFromStorage to handle plain localStorage
async function loadFromStorage(){
  try{
    if(window.storage) {
        const c = await window.storage.get(CONTACTS_KEY, false);
        if(c && c.value) contacts = JSON.parse(c.value);
    } else {
        const c = localStorage.getItem(CONTACTS_KEY);
        if(c) contacts = JSON.parse(c);
    }
  }catch(e){ contacts = []; }
  try{
    if(window.storage) {
        const p = await window.storage.get(PROGRESS_KEY, false);
        if(p && p.value) sentSet = new Set(JSON.parse(p.value));
    } else {
        const p = localStorage.getItem(PROGRESS_KEY);
        if(p) sentSet = new Set(JSON.parse(p));
    }
  }catch(e){ sentSet = new Set(); }
}


// ---------- Rendering ----------
function render(){
  const q = searchBox.value.trim().toLowerCase();
  const onlyPending = pendingOnly.checked;

  tableBody.innerHTML = '';
  let shown = 0;

  contacts.forEach((c, idx) => {
    const isSent = sentSet.has(c.phone + '|' + idx);
    if(onlyPending && isSent) return;
    if(q && !(c.name.toLowerCase().includes(q) || c.phone.includes(q))) return;
    shown++;

    const tr = document.createElement('tr');
    if(isSent) tr.className = 'sent';

    const message = MESSAGE_TEMPLATE.replace('{first_name}', c.firstName);
    const link = `https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`;

    tr.innerHTML = `
      <td class="name-cell">${escapeHtml(c.name)}</td>
      <td class="phone-cell">${c.valid ? escapeHtml(c.phone) : `<span class="invalid">${escapeHtml(c.phone || '—')} (check)</span>`}</td>
      <td>${c.stage ? `<span class="stage-badge">${escapeHtml(c.stage)}</span>` : ''}</td>
      <td>${isSent ? '<span class="sent-tag">✓ Sent</span>' : ''}</td>
      <td class="row-actions">
        <a class="btn small" href="${link}" target="_blank" rel="noopener" data-idx="${idx}">Open chat</a>
        <button class="btn ghost small" data-toggle="${idx}">${isSent ? 'Undo' : 'Mark sent'}</button>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  emptyState.style.display = shown === 0 ? 'block' : 'none';

  const total = contacts.length;
  const sentCount = contacts.filter((c, idx) => sentSet.has(c.phone + '|' + idx)).length;
  document.getElementById('progressFill').style.width = total ? `${(sentCount/total*100).toFixed(1)}%` : '0%';
  document.getElementById('progressLabel').textContent = `${sentCount} / ${total} sent`;
}

function escapeHtml(s){
  return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

tableBody.addEventListener('click', (e) => {
  const openLink = e.target.closest('a[data-idx]');
  if(openLink){
    const idx = openLink.getAttribute('data-idx');
    const c = contacts[idx];
    sentSet.add(c.phone + '|' + idx);
    saveProgress();
    setTimeout(render, 150);
    return;
  }
  const toggleBtn = e.target.closest('button[data-toggle]');
  if(toggleBtn){
    const idx = toggleBtn.getAttribute('data-toggle');
    const c = contacts[idx];
    const key = c.phone + '|' + idx;
    if(sentSet.has(key)) sentSet.delete(key); else sentSet.add(key);
    saveProgress();
    render();
  }
});

searchBox.addEventListener('input', render);
pendingOnly.addEventListener('change', render);

document.getElementById('resetBtn').addEventListener('click', async () => {
  if(!confirm('Clear sent/pending progress for all contacts? Your contact list stays.')) return;
  sentSet = new Set();
  await saveProgress();
  render();
});

document.getElementById('newCsvBtn').addEventListener('click', async () => {
  if(!confirm('Upload a different CSV? This replaces the current contact list (progress will reset too).')) return;
  contacts = [];
  sentSet = new Set();
  try{
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
      contacts = buildContacts(rows);
      if(contacts.length === 0) throw new Error('No contact rows found.');
      sentSet = new Set();
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
