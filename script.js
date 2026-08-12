const DEFAULT_TEMPLATE = `Happy New Month, {first_name}. This is Adura from Futapreneurs. How have you been? I have four questions and a good news for you. [1] What's the update about your entrepreneurial journey so far? [2] is there anything you'd love to share regarding your personal and business growth since the beginning of the year till today? [3] Do you have any comment, suggestion and/or advice regarding futapreneurs, of the moment.        Unto, my good news,  I'm also happy to tell you, if you did not know that the Futapreneurs summit is coming up on the 24th of this month from 10am till the evening, at the Obafemi Awolowo Auditorium. The theme is Marketing, Sales and Money. We are gathering to connect with each other, and to learn from Top Experts in the field of Marketing, Sales and Our Finances. Over 120 people are registered, and vendors are plenty (those guys are going to be showing their business to hundreds of entreprenuers across FUTA), if you want to be part of them, you can do well to register as a vendor (there's only 24 spots left). I'd love to see you at the Summit. Let's I forget, don't forget to dress well, and carry your networking superpower when you're coming for the summit. Last Question [4] Are you registered for the summit?`;

const SESSIONS_KEY = 'wa-outreach-sessions-v2';

let sessions = []; // Array of session objects
let currentSession = null;
let lastSentKey = null;

// Temporary vars during CSV upload mapping
let pendingCSVHeaders = [];
let pendingCSVRows = [];

// DOM Elements
const viewDashboard = document.getElementById('viewDashboard');
const viewUpload = document.getElementById('viewUpload');
const viewSession = document.getElementById('viewSession');

const sessionList = document.getElementById('sessionList');
const dashboardEmpty = document.getElementById('dashboardEmpty');
const dashboardError = document.getElementById('dashboardError');

const uploadStep1 = document.getElementById('uploadStep1');
const uploadStep2 = document.getElementById('uploadStep2');
const uploadError = document.getElementById('uploadError');
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');

const mapNameCol = document.getElementById('mapNameCol');
const mapPhoneCol = document.getElementById('mapPhoneCol');
const mapStageCol = document.getElementById('mapStageCol');

const sessionTitleDisplay = document.getElementById('sessionTitleDisplay');
const templateInput = document.getElementById('templateInput');
const tableBody = document.getElementById('tableBody');
const searchBox = document.getElementById('searchBox');
const pendingOnly = document.getElementById('pendingOnly');
const emptyState = document.getElementById('emptyState');
const nextPendingBtn = document.getElementById('nextPendingBtn');
const undoGlobalBtn = document.getElementById('undoGlobalBtn');
const batchFirstNameSelect = document.getElementById('batchFirstNameSelect');

const statTotal = document.getElementById('statTotal');
const statSent = document.getElementById('statSent');
const statPending = document.getElementById('statPending');
const progressFill = document.getElementById('progressFill');

// ---------- Storage ----------
async function loadSessions(){
  try {
    let raw = null;
    if(window.storage) {
        const c = await window.storage.get(SESSIONS_KEY, false);
        raw = c ? c.value : null;
    } else {
        raw = localStorage.getItem(SESSIONS_KEY);
    }
    if(raw) sessions = JSON.parse(raw);
  } catch(e){
    sessions = [];
  }
}

async function saveSessions(){
  dashboardError.textContent = '';
  try {
    const raw = JSON.stringify(sessions);
    if(window.storage) {
        await window.storage.set(SESSIONS_KEY, raw, false);
    } else {
        localStorage.setItem(SESSIONS_KEY, raw);
    }
  } catch(e){ 
    console.error('Save failed', e); 
    if(e.name === 'QuotaExceededError') {
        dashboardError.textContent = "Storage limit reached! Please delete some old campaigns to save new ones.";
    }
  }
}

// ---------- Routing ----------
function showView(view) {
    viewDashboard.style.display = 'none';
    viewUpload.style.display = 'none';
    viewSession.style.display = 'none';
    
    if(view === 'dashboard') {
        renderDashboard();
        viewDashboard.style.display = 'block';
    } else if(view === 'upload') {
        uploadStep1.style.display = 'block';
        uploadStep2.style.display = 'none';
        uploadError.textContent = '';
        viewUpload.style.display = 'block';
    } else if(view === 'session') {
        renderSession();
        viewSession.style.display = 'block';
    }
}

// ---------- Dashboard ----------
function renderDashboard() {
    sessionList.innerHTML = '';
    if(sessions.length === 0) {
        dashboardEmpty.style.display = 'block';
    } else {
        dashboardEmpty.style.display = 'none';
        // Sort newest first
        const sorted = [...sessions].sort((a,b) => b.timestamp - a.timestamp);
        
        sorted.forEach(s => {
            const div = document.createElement('div');
            div.className = 'session-item';
            
            const total = s.contacts.length;
            const sent = s.sentSet.length;
            
            div.innerHTML = `
                <div class="session-info">
                    <h3>${escapeHtml(s.name)}</h3>
                    <div class="session-meta">Created: ${new Date(s.timestamp).toLocaleString()} &bull; ${sent}/${total} Sent</div>
                </div>
                <button class="btn small" data-open-session="${s.id}">Open</button>
            `;
            sessionList.appendChild(div);
        });
    }
}

sessionList.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-open-session]');
    if(btn) {
        const id = btn.getAttribute('data-open-session');
        currentSession = sessions.find(s => s.id === id);
        if(currentSession) {
            lastSentKey = null;
            undoGlobalBtn.style.display = 'none';
            templateInput.value = currentSession.template || DEFAULT_TEMPLATE;
            showView('session');
        }
    }
});

document.getElementById('btnNewCampaign').addEventListener('click', () => {
    showView('upload');
});
document.getElementById('btnCancelUpload').addEventListener('click', () => {
    showView('dashboard');
});
document.getElementById('btnBackToDash').addEventListener('click', () => {
    saveSessions();
    showView('dashboard');
});

document.getElementById('btnEditSessionName').addEventListener('click', () => {
    const newName = prompt("Enter new campaign name:", currentSession.name);
    if(newName && newName.trim()) {
        currentSession.name = newName.trim();
        saveSessions();
        renderSession();
    }
});
document.getElementById('btnDeleteSession').addEventListener('click', () => {
    if(confirm(`Are you sure you want to delete campaign "${currentSession.name}"? This cannot be undone.`)) {
        sessions = sessions.filter(s => s.id !== currentSession.id);
        currentSession = null;
        saveSessions();
        showView('dashboard');
    }
});

// ---------- Upload & Mapping ----------
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

function handleFile(file){
  uploadError.textContent = '';
  const reader = new FileReader();
  reader.onload = (e) => {
    try{
      const rows = parseCSV(e.target.result);
      if(rows.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
      
      pendingCSVHeaders = rows[0].map(h => h.trim());
      pendingCSVRows = rows.slice(1);
      
      // Populate Mapping UI
      mapNameCol.innerHTML = '';
      mapPhoneCol.innerHTML = '';
      mapStageCol.innerHTML = '<option value="-1">-- None --</option>';
      
      let bestName = 0, bestPhone = 0, bestStage = -1;
      
      pendingCSVHeaders.forEach((h, i) => {
          const hl = h.toLowerCase();
          if(hl.includes('name')) bestName = i;
          if(hl.includes('phone') || hl.includes('number') || hl.includes('contact')) bestPhone = i;
          if(hl.includes('stage') || hl.includes('level')) bestStage = i;
          
          mapNameCol.innerHTML += `<option value="${i}">${escapeHtml(h)}</option>`;
          mapPhoneCol.innerHTML += `<option value="${i}">${escapeHtml(h)}</option>`;
          mapStageCol.innerHTML += `<option value="${i}">${escapeHtml(h)}</option>`;
      });
      
      // Fallback
      if(bestName === bestPhone && pendingCSVHeaders.length > 1) {
          bestName = 0;
          bestPhone = 1;
      }
      
      mapNameCol.value = bestName;
      mapPhoneCol.value = bestPhone;
      mapStageCol.value = bestStage;
      
      uploadStep1.style.display = 'none';
      uploadStep2.style.display = 'block';

    }catch(err){
      uploadError.textContent = err.message;
    }
  };
  reader.readAsText(file);
}

document.getElementById('btnSaveMapping').addEventListener('click', async () => {
    const nIdx = parseInt(mapNameCol.value, 10);
    const pIdx = parseInt(mapPhoneCol.value, 10);
    const sIdx = parseInt(mapStageCol.value, 10);
    
    if(nIdx === pIdx) {
        alert("Name and Phone must be different columns.");
        return;
    }
    
    const contacts = pendingCSVRows.map(r => {
        const name = (r[nIdx] || '').trim();
        const rawPhone = (r[pIdx] || '').trim();
        const stage = (sIdx !== -1 && sIdx < r.length) ? (r[sIdx] || '').trim() : '';
        
        let p = rawPhone.replace(/[^\d+]/g,'');
        if(p.startsWith('+')) p = p.slice(1);
        if(p.startsWith('0')) p = '234' + p.slice(1);
        else if(p.length === 10) p = '234' + p;
        
        const valid = /^234\d{10}$/.test(p) || (p.length >= 11 && p.length <= 13);
        const nameWords = name.split(/\s+/).filter(w => w.length > 0);
        if(nameWords.length === 0) nameWords.push('Friend');
        
        return { name, phone: p, stage, valid, nameWords, firstNameIndex: 0 };
    }).filter(c => c.name || c.phone);
    
    if(contacts.length === 0) {
        alert("No valid contacts found with those columns.");
        return;
    }
    
    const timestamp = Date.now();
    const newSession = {
        id: timestamp.toString(),
        name: `Campaign - ${new Date(timestamp).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}`,
        timestamp: timestamp,
        template: DEFAULT_TEMPLATE,
        contacts: contacts,
        sentSet: [],
        mapping: { nameIdx: nIdx, phoneIdx: pIdx, stageIdx: sIdx }
    };
    
    sessions.push(newSession);
    await saveSessions();
    
    currentSession = newSession;
    lastSentKey = null;
    undoGlobalBtn.style.display = 'none';
    templateInput.value = currentSession.template;
    showView('session');
});

fileInput.addEventListener('change', () => { if(fileInput.files[0]) handleFile(fileInput.files[0]); });
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag');
  if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});
dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

// ---------- Session Logic ----------

templateInput.addEventListener('input', () => {
    if(currentSession) {
        currentSession.template = templateInput.value;
        saveSessions();
        renderSession();
    }
});

function generateMessage(c) {
    let tpl = currentSession.template;
    tpl = tpl.replace(/{name}/g, c.name);
    const firstName = c.nameWords[c.firstNameIndex] || c.nameWords[0];
    tpl = tpl.replace(/{first_name}/g, firstName);
    tpl = tpl.replace(/{phone}/g, c.phone);
    return tpl;
}

function renderSession(){
  if(!currentSession) return;
  
  sessionTitleDisplay.textContent = currentSession.name;
  
  const q = searchBox.value.trim().toLowerCase();
  const onlyPending = pendingOnly.checked;

  tableBody.innerHTML = '';
  let shown = 0;
  let nextPendingIndex = -1;
  
  const sentSetFast = new Set(currentSession.sentSet);

  currentSession.contacts.forEach((c, idx) => {
    const key = c.phone + '|' + idx;
    const isSent = sentSetFast.has(key);
    
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

    let selectOptions = '';
    c.nameWords.forEach((word, wordIdx) => {
        const selected = wordIdx === c.firstNameIndex ? 'selected' : '';
        selectOptions += `<option value="${wordIdx}" ${selected}>${escapeHtml(word)}</option>`;
    });
    
    // Inline phone editing if invalid
    let phoneDisplay = '';
    if(c.valid) {
        phoneDisplay = escapeHtml(c.phone);
    } else {
        phoneDisplay = `
            <div class="inline-edit-wrap">
                <input type="text" class="inline-input" value="${escapeHtml(c.phone)}" data-edit-phone="${idx}">
                <button class="btn small interactive" data-save-phone="${idx}">Save</button>
            </div>
            <div class="invalid" style="font-size:11px; margin-top:4px;">Invalid number</div>
        `;
    }

    tr.innerHTML = `
      <td class="name-cell">${escapeHtml(c.name)}</td>
      <td>
        <select class="interactive" aria-label="Select first name for ${escapeHtml(c.name)}" data-name-select="${idx}">
            ${selectOptions}
        </select>
      </td>
      <td class="phone-cell">${phoneDisplay}</td>
      <td>${c.stage ? `<span class="stage-badge">${escapeHtml(c.stage)}</span>` : ''}</td>
      <td>${isSent ? 'Sent' : 'Pending'}</td>
      <td>
        <div style="display:flex;gap:6px;">
            <a class="btn btn-primary small interactive ${c.valid ? '' : 'invalid'}" ${c.valid ? `href="${link}"` : 'disabled'} target="_blank" rel="noopener" data-idx="${idx}">Open chat</a>
            <button class="btn small interactive" data-toggle="${idx}" ${!c.valid && !isSent ? 'disabled' : ''}>${isSent ? 'Undo' : 'Mark sent'}</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });

  emptyState.style.display = shown === 0 ? 'block' : 'none';

  // Stats
  const total = currentSession.contacts.length;
  const sentCount = currentSession.sentSet.length;
  const pendingCount = total - sentCount;
  
  statTotal.textContent = total;
  statSent.textContent = sentCount;
  statPending.textContent = pendingCount;
  
  progressFill.style.width = total ? `${(sentCount/total*100)}%` : '0%';

  // Next Pending Button state
  if (nextPendingIndex !== -1) {
      nextPendingBtn.disabled = false;
      const firstName = currentSession.contacts[nextPendingIndex].nameWords[currentSession.contacts[nextPendingIndex].firstNameIndex];
      nextPendingBtn.textContent = `Message Next Pending (${escapeHtml(firstName)})`;
      nextPendingBtn.onclick = () => {
          const c = currentSession.contacts[nextPendingIndex];
          const key = c.phone + '|' + nextPendingIndex;
          
          const message = generateMessage(c);
          window.open(`https://wa.me/${c.phone}?text=${encodeURIComponent(message)}`, '_blank');
          
          currentSession.sentSet.push(key);
          lastSentKey = key;
          saveSessions();
          undoGlobalBtn.style.display = 'inline-flex';
          setTimeout(renderSession, 150);
      };
  } else {
      nextPendingBtn.disabled = true;
      nextPendingBtn.textContent = `All Done!`;
      nextPendingBtn.onclick = null;
  }
}

// Global Undo
undoGlobalBtn.addEventListener('click', () => {
    if(!currentSession) return;
    if(lastSentKey && currentSession.sentSet.includes(lastSentKey)) {
        currentSession.sentSet = currentSession.sentSet.filter(k => k !== lastSentKey);
        lastSentKey = null;
        saveSessions();
        undoGlobalBtn.style.display = 'none';
        renderSession();
    }
});

// Table interactions
tableBody.addEventListener('click', (e) => {
  if(!currentSession) return;
  
  // Save inline phone edit
  const savePhoneBtn = e.target.closest('button[data-save-phone]');
  if(savePhoneBtn) {
      const idx = savePhoneBtn.getAttribute('data-save-phone');
      const input = document.querySelector(`input[data-edit-phone="${idx}"]`);
      if(input) {
          let p = input.value.replace(/[^\d+]/g,'');
          if(p.startsWith('+')) p = p.slice(1);
          if(p.startsWith('0')) p = '234' + p.slice(1);
          else if(p.length === 10) p = '234' + p;
          
          currentSession.contacts[idx].phone = p;
          currentSession.contacts[idx].valid = /^234\d{10}$/.test(p) || (p.length >= 11 && p.length <= 13);
          saveSessions();
          renderSession();
      }
      return;
  }

  const openLink = e.target.closest('a[data-idx]');
  if(openLink && !openLink.hasAttribute('disabled')){
    const idx = openLink.getAttribute('data-idx');
    const c = currentSession.contacts[idx];
    const key = c.phone + '|' + idx;
    if(!currentSession.sentSet.includes(key)) {
        currentSession.sentSet.push(key);
    }
    lastSentKey = key;
    undoGlobalBtn.style.display = 'inline-flex';
    saveSessions();
    setTimeout(renderSession, 150);
    return;
  }
  
  const toggleBtn = e.target.closest('button[data-toggle]');
  if(toggleBtn && !toggleBtn.hasAttribute('disabled')){
    const idx = toggleBtn.getAttribute('data-toggle');
    const c = currentSession.contacts[idx];
    const key = c.phone + '|' + idx;
    
    if(currentSession.sentSet.includes(key)) {
        currentSession.sentSet = currentSession.sentSet.filter(k => k !== key);
        if(lastSentKey === key) { lastSentKey = null; undoGlobalBtn.style.display = 'none'; }
    } else {
        currentSession.sentSet.push(key);
        lastSentKey = key;
        undoGlobalBtn.style.display = 'inline-flex';
    }
    saveSessions();
    renderSession();
  }
});

// Batch First Name Dropdown
batchFirstNameSelect.addEventListener('change', (e) => {
    if(!currentSession) return;
    const val = parseInt(e.target.value, 10);
    if(isNaN(val)) return;

    currentSession.contacts.forEach(c => {
        if(val === -1) {
            c.firstNameIndex = Math.max(0, c.nameWords.length - 1);
        } else {
            c.firstNameIndex = Math.min(val, Math.max(0, c.nameWords.length - 1));
        }
    });

    saveSessions();
    renderSession();
    e.target.value = "none";
});

// Individual Name Dropdown
tableBody.addEventListener('change', (e) => {
    if(!currentSession) return;
    if(e.target.hasAttribute('data-name-select')) {
        const idx = e.target.getAttribute('data-name-select');
        const newWordIdx = parseInt(e.target.value, 10);
        currentSession.contacts[idx].firstNameIndex = newWordIdx;
        saveSessions();
        renderSession(); 
    }
});

searchBox.addEventListener('input', renderSession);
pendingOnly.addEventListener('change', renderSession);

// ---------- Init ----------
function escapeHtml(s){
  return (s || '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

(async function init(){
  await loadSessions();
  showView('dashboard');
})();
