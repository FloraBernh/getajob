// === STATE ===
let state = {
    cvText: '',
    cvFileName: '',
    coverLetters: [],
    caseTexts: [],
    jobs: [],
    generatedLetters: [],
    documents: [],
    aiModel: 'claude-3-5-sonnet',
    editingLetterId: null,
    editingCaseId: null,
    editingJobId: null,
};

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    setupEventListeners();
    setupFileUploads();
    await loadAllData();
    renderAll();
    updateAuthUI();
});

// === NAVIGATION ===
function setupNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = link.dataset.tab;
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${tab}`).classList.add('active');

            if (tab === 'generate') {
                populateJobSelect();
            }
        });
    });
}

// === AUTH ===
async function updateAuthUI() {
    const userInfo = document.getElementById('user-info');
    try {
        if (puter.auth.isSignedIn()) {
            const user = await puter.auth.getUser();
            const initial = (user.username || 'U')[0].toUpperCase();
            userInfo.innerHTML = `
                <div class="user-signed-in">
                    <div class="user-avatar">${initial}</div>
                    <div>
                        <div class="user-name">${user.username}</div>
                        <a href="#" id="sign-out-link" style="font-size: 0.75rem; color: var(--text-sidebar); opacity: 0.7;">Logga ut</a>
                    </div>
                </div>
            `;
            document.getElementById('sign-out-link')?.addEventListener('click', async (e) => {
                e.preventDefault();
                await puter.auth.signOut();
                location.reload();
            });
        }
    } catch (e) {
        userInfo.innerHTML = `<button id="sign-in-btn" class="btn btn-primary" style="width:100%;">Logga in med Puter</button>`;
        document.getElementById('sign-in-btn').addEventListener('click', async () => {
            await puter.auth.signIn();
            location.reload();
        });
    }
}

// === DATA LAYER (Puter KV) ===
async function saveData(key, value) {
    try {
        await puter.kv.set(key, JSON.stringify(value));
    } catch (e) {
        console.error(`Failed to save ${key}:`, e);
    }
}

async function loadData(key, fallback) {
    try {
        const raw = await puter.kv.get(key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Failed to load ${key}:`, e);
        return fallback;
    }
}

async function loadAllData() {
    try {
        state.cvText = await loadData('cv_text', '');
        state.cvFileName = await loadData('cv_file_name', '');
        state.coverLetters = await loadData('cover_letters', []);
        state.caseTexts = await loadData('case_texts', []);
        state.jobs = await loadData('jobs', []);
        state.generatedLetters = await loadData('generated_letters', []);
        state.documents = await loadData('documents', []);
        state.aiModel = await loadData('ai_model', 'claude-3-5-sonnet');
    } catch (e) {
        console.error('Failed to load data:', e);
    }
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // CV
    document.getElementById('save-cv-btn').addEventListener('click', saveCV);

    // Cover Letters
    document.getElementById('add-letter-btn').addEventListener('click', () => showForm('letter'));
    document.getElementById('save-letter-btn').addEventListener('click', saveLetter);
    document.getElementById('cancel-letter-btn').addEventListener('click', () => hideForm('letter'));

    // Case Texts
    document.getElementById('add-case-btn').addEventListener('click', () => showForm('case'));
    document.getElementById('save-case-btn').addEventListener('click', saveCase);
    document.getElementById('cancel-case-btn').addEventListener('click', () => hideForm('case'));

    // Jobs
    document.getElementById('add-job-btn').addEventListener('click', () => showForm('job'));
    document.getElementById('save-job-btn').addEventListener('click', saveJob);
    document.getElementById('cancel-job-btn').addEventListener('click', () => hideForm('job'));

    // Generate
    document.getElementById('job-select').addEventListener('change', onJobSelect);
    document.getElementById('generate-btn').addEventListener('click', generateLetter);
    document.getElementById('copy-result-btn').addEventListener('click', copyResult);
    document.getElementById('save-result-btn').addEventListener('click', saveResult);

    // Settings
    document.getElementById('save-model-btn').addEventListener('click', saveModel);
    document.getElementById('export-btn').addEventListener('click', exportData);

    // Sign in
    document.getElementById('sign-in-btn')?.addEventListener('click', async () => {
        await puter.auth.signIn();
        location.reload();
    });
}

// === FILE UPLOADS ===
function setupFileUploads() {
    // CV upload zone
    const cvZone = document.getElementById('cv-upload-zone');
    const cvInput = document.getElementById('cv-file-input');

    cvZone.addEventListener('click', () => cvInput.click());
    document.getElementById('cv-file-browse').addEventListener('click', (e) => {
        e.preventDefault();
        cvInput.click();
    });

    cvZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        cvZone.classList.add('drag-over');
    });
    cvZone.addEventListener('dragleave', () => cvZone.classList.remove('drag-over'));
    cvZone.addEventListener('drop', (e) => {
        e.preventDefault();
        cvZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) handleCVFile(e.dataTransfer.files[0]);
    });
    cvInput.addEventListener('change', () => {
        if (cvInput.files.length > 0) handleCVFile(cvInput.files[0]);
        cvInput.value = '';
    });

    document.getElementById('cv-file-remove').addEventListener('click', removeCVFile);

    // Documents upload zone
    const docsZone = document.getElementById('docs-upload-zone');
    const docsInput = document.getElementById('docs-file-input');

    docsZone.addEventListener('click', () => docsInput.click());
    document.getElementById('docs-file-browse').addEventListener('click', (e) => {
        e.preventDefault();
        docsInput.click();
    });

    docsZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        docsZone.classList.add('drag-over');
    });
    docsZone.addEventListener('dragleave', () => docsZone.classList.remove('drag-over'));
    docsZone.addEventListener('drop', (e) => {
        e.preventDefault();
        docsZone.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        files.forEach(f => handleDocumentFile(f));
    });
    docsInput.addEventListener('change', () => {
        Array.from(docsInput.files).forEach(f => handleDocumentFile(f));
        docsInput.value = '';
    });
}

async function handleCVFile(file) {
    const statusEl = document.getElementById('cv-status');

    if (file.type === 'application/pdf') {
        try {
            showStatus('cv-status', 'Extraherar text från PDF...');
            const text = await extractTextFromPDF(file);
            document.getElementById('cv-text').value = text;
            state.cvText = text;
            state.cvFileName = file.name;
            await saveData('cv_text', state.cvText);
            await saveData('cv_file_name', state.cvFileName);
            showCVFileInfo(file.name);
            showStatus('cv-status', 'PDF importerad och sparad!');
        } catch (e) {
            console.error('PDF extraction failed:', e);
            showStatus('cv-status', 'Kunde inte läsa PDF. Prova klistra in texten manuellt.');
        }
    } else if (file.type === 'text/plain') {
        const text = await file.text();
        document.getElementById('cv-text').value = text;
        state.cvText = text;
        state.cvFileName = file.name;
        await saveData('cv_text', state.cvText);
        await saveData('cv_file_name', state.cvFileName);
        showCVFileInfo(file.name);
        showStatus('cv-status', 'Textfil importerad och sparad!');
    } else {
        showStatus('cv-status', 'Filtypen stöds inte. Använd PDF eller TXT.');
    }
}

async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += pageText + '\n\n';
    }

    return fullText.trim();
}

function showCVFileInfo(name) {
    document.getElementById('cv-file-name').textContent = name;
    document.getElementById('cv-file-info').classList.remove('hidden');
}

async function removeCVFile() {
    state.cvFileName = '';
    await saveData('cv_file_name', '');
    document.getElementById('cv-file-info').classList.add('hidden');
}

async function handleDocumentFile(file) {
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        alert(`${file.name} är för stor (max 10MB).`);
        return;
    }

    const id = generateId();
    const isImage = file.type.startsWith('image/');

    // Convert to base64 for storage in KV
    const base64 = await fileToBase64(file);

    const doc = {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        isImage,
        data: base64,
        date: new Date().toISOString()
    };

    state.documents.push(doc);
    await saveData('documents', state.documents);
    renderDocuments();
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function downloadDocument(id) {
    const doc = state.documents.find(d => d.id === id);
    if (!doc) return;

    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.name;
    a.click();
}

async function deleteDocument(id) {
    state.documents = state.documents.filter(d => d.id !== id);
    await saveData('documents', state.documents);
    renderDocuments();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type) {
    if (type === 'application/pdf') return '📕';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('word') || type.includes('document')) return '📘';
    return '📄';
}

// === CV ===
async function saveCV() {
    state.cvText = document.getElementById('cv-text').value;
    await saveData('cv_text', state.cvText);
    showStatus('cv-status', 'Sparat!');
}

// === COVER LETTERS ===
function saveLetter() {
    const title = document.getElementById('letter-title').value.trim();
    const text = document.getElementById('letter-text').value.trim();
    if (!title || !text) return;

    if (state.editingLetterId) {
        const idx = state.coverLetters.findIndex(l => l.id === state.editingLetterId);
        if (idx >= 0) {
            state.coverLetters[idx].title = title;
            state.coverLetters[idx].text = text;
        }
        state.editingLetterId = null;
    } else {
        state.coverLetters.push({
            id: generateId(),
            title,
            text,
            date: new Date().toISOString()
        });
    }

    saveData('cover_letters', state.coverLetters);
    hideForm('letter');
    renderLetters();
}

function editLetter(id) {
    const letter = state.coverLetters.find(l => l.id === id);
    if (!letter) return;
    state.editingLetterId = id;
    document.getElementById('letter-title').value = letter.title;
    document.getElementById('letter-text').value = letter.text;
    document.getElementById('letter-form-title').textContent = 'Redigera personligt brev';
    showForm('letter');
}

async function deleteLetter(id) {
    state.coverLetters = state.coverLetters.filter(l => l.id !== id);
    await saveData('cover_letters', state.coverLetters);
    renderLetters();
}

// === CASE TEXTS ===
function saveCase() {
    const title = document.getElementById('case-title').value.trim();
    const text = document.getElementById('case-text').value.trim();
    if (!title || !text) return;

    if (state.editingCaseId) {
        const idx = state.caseTexts.findIndex(c => c.id === state.editingCaseId);
        if (idx >= 0) {
            state.caseTexts[idx].title = title;
            state.caseTexts[idx].text = text;
        }
        state.editingCaseId = null;
    } else {
        state.caseTexts.push({
            id: generateId(),
            title,
            text,
            date: new Date().toISOString()
        });
    }

    saveData('case_texts', state.caseTexts);
    hideForm('case');
    renderCases();
}

function editCase(id) {
    const c = state.caseTexts.find(c => c.id === id);
    if (!c) return;
    state.editingCaseId = id;
    document.getElementById('case-title').value = c.title;
    document.getElementById('case-text').value = c.text;
    document.getElementById('case-form-title').textContent = 'Redigera case-text';
    showForm('case');
}

async function deleteCase(id) {
    state.caseTexts = state.caseTexts.filter(c => c.id !== id);
    await saveData('case_texts', state.caseTexts);
    renderCases();
}

// === JOBS ===
function saveJob() {
    const title = document.getElementById('job-title').value.trim();
    const company = document.getElementById('job-company').value.trim();
    const description = document.getElementById('job-description').value.trim();
    if (!title || !company || !description) return;

    if (state.editingJobId) {
        const idx = state.jobs.findIndex(j => j.id === state.editingJobId);
        if (idx >= 0) {
            state.jobs[idx].title = title;
            state.jobs[idx].company = company;
            state.jobs[idx].description = description;
        }
        state.editingJobId = null;
    } else {
        state.jobs.push({
            id: generateId(),
            title,
            company,
            description,
            date: new Date().toISOString()
        });
    }

    saveData('jobs', state.jobs);
    hideForm('job');
    renderJobs();
}

function editJob(id) {
    const job = state.jobs.find(j => j.id === id);
    if (!job) return;
    state.editingJobId = id;
    document.getElementById('job-title').value = job.title;
    document.getElementById('job-company').value = job.company;
    document.getElementById('job-description').value = job.description;
    document.getElementById('job-form-title').textContent = 'Redigera jobb';
    showForm('job');
}

async function deleteJob(id) {
    state.jobs = state.jobs.filter(j => j.id !== id);
    await saveData('jobs', state.jobs);
    renderJobs();
}

// === GENERATE ===
function onJobSelect() {
    const jobId = document.getElementById('job-select').value;
    const preview = document.getElementById('selected-job-preview');

    if (!jobId) {
        preview.classList.add('hidden');
        return;
    }

    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    document.getElementById('preview-title').textContent = job.title;
    document.getElementById('preview-company').textContent = job.company;
    document.getElementById('preview-description').textContent = job.description;
    preview.classList.remove('hidden');
}

async function generateLetter() {
    const jobId = document.getElementById('job-select').value;
    if (!jobId) {
        alert('Välj ett jobb först!');
        return;
    }

    const job = state.jobs.find(j => j.id === jobId);
    if (!job) return;

    if (!state.cvText && state.coverLetters.length === 0) {
        alert('Lägg till ditt CV eller minst ett personligt brev under "Min profil" först!');
        return;
    }

    const generateBtn = document.getElementById('generate-btn');
    const statusBox = document.getElementById('generate-status');
    const resultCard = document.getElementById('generated-result');

    generateBtn.disabled = true;
    statusBox.classList.remove('hidden');
    resultCard.classList.add('hidden');

    // Build the prompt
    const extraInstructions = document.getElementById('extra-instructions').value.trim();
    const prompt = buildPrompt(job, extraInstructions);

    try {
        const response = await puter.ai.chat(prompt, {
            model: state.aiModel,
        });

        const generatedText = response?.message?.content?.[0]?.text
            || response?.message?.content
            || response?.toString?.()
            || response;

        document.getElementById('generated-text').textContent = typeof generatedText === 'string'
            ? generatedText
            : JSON.stringify(generatedText);
        resultCard.classList.remove('hidden');
    } catch (e) {
        console.error('AI generation failed:', e);
        alert('Kunde inte generera brev. Kontrollera att du är inloggad och försök igen.\n\nFel: ' + e.message);
    } finally {
        generateBtn.disabled = false;
        statusBox.classList.add('hidden');
    }
}

function buildPrompt(job, extraInstructions) {
    let prompt = `Du är en expert på att skriva personliga brev för jobbansökningar på svenska. Din uppgift är att skriva ett personligt brev som:
1. Matchar jobbets krav och beskrivning
2. Utgår från kandidatens CV och erfarenhet
3. Har EXAKT samma tonalitet, stil och röst som kandidatens egna texter

VIKTIGT: Analysera referenstexterna noga. Matcha:
- Meningslängd och struktur
- Formalitetsnivå (du/ni, formellt/informellt)
- Ordval och uttryck
- Hur kandidaten beskriver sig själv
- Styckeindelning och textlängd

---

JOBBESKRIVNING:
Titel: ${job.title}
Företag: ${job.company}
Beskrivning:
${job.description}

---
`;

    if (state.cvText) {
        prompt += `\nKANDIDATENS CV:\n${state.cvText}\n\n---\n`;
    }

    if (state.coverLetters.length > 0) {
        prompt += `\nREFERENSTEXTER - PERSONLIGA BREV (använd dessa för att matcha tonalitet och stil):\n`;
        state.coverLetters.forEach((letter, i) => {
            prompt += `\n[Brev ${i + 1}: "${letter.title}"]\n${letter.text}\n`;
        });
        prompt += `\n---\n`;
    }

    if (state.caseTexts.length > 0) {
        prompt += `\nREFERENSTEXTER - CASE/SKRIVPROV (ytterligare stilreferens):\n`;
        state.caseTexts.forEach((c, i) => {
            prompt += `\n[Case ${i + 1}: "${c.title}"]\n${c.text}\n`;
        });
        prompt += `\n---\n`;
    }

    if (extraInstructions) {
        prompt += `\nEXTRA INSTRUKTIONER FRÅN KANDIDATEN:\n${extraInstructions}\n\n---\n`;
    }

    prompt += `\nSkriv nu ett personligt brev för jobbet ovan. Brevet ska låta som att kandidaten själv har skrivit det, baserat på referenstexterna. Skriv BARA brevet, ingen annan text.`;

    return prompt;
}

function copyResult() {
    const text = document.getElementById('generated-text').textContent;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copy-result-btn');
        btn.textContent = 'Kopierat!';
        setTimeout(() => btn.textContent = 'Kopiera', 2000);
    });
}

async function saveResult() {
    const text = document.getElementById('generated-text').textContent;
    const jobId = document.getElementById('job-select').value;
    const job = state.jobs.find(j => j.id === jobId);

    state.generatedLetters.push({
        id: generateId(),
        jobId,
        jobTitle: job?.title || 'Okänt jobb',
        jobCompany: job?.company || '',
        text,
        date: new Date().toISOString()
    });

    await saveData('generated_letters', state.generatedLetters);
    renderGeneratedLetters();

    const btn = document.getElementById('save-result-btn');
    btn.textContent = 'Sparat!';
    setTimeout(() => btn.textContent = 'Spara', 2000);
}

// === SETTINGS ===
async function saveModel() {
    state.aiModel = document.getElementById('ai-model-select').value;
    await saveData('ai_model', state.aiModel);
    showStatus('model-status', 'Sparat!');
}

async function exportData() {
    const data = {
        cvText: state.cvText,
        coverLetters: state.coverLetters,
        caseTexts: state.caseTexts,
        jobs: state.jobs,
        generatedLetters: state.generatedLetters,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jobbsokaren-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// === RENDER ===
function renderAll() {
    document.getElementById('cv-text').value = state.cvText;
    document.getElementById('ai-model-select').value = state.aiModel;
    if (state.cvFileName) showCVFileInfo(state.cvFileName);
    renderLetters();
    renderCases();
    renderJobs();
    renderGeneratedLetters();
    renderDocuments();
}

function renderLetters() {
    const list = document.getElementById('letters-list');
    if (state.coverLetters.length === 0) {
        list.innerHTML = '<div class="empty-state">Inga personliga brev tillagda ännu. Klicka "Lägg till" för att börja.</div>';
        return;
    }
    list.innerHTML = state.coverLetters.map(letter => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(letter.title)}</div>
                    <div class="item-meta">${formatDate(letter.date)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small" onclick="editLetter('${letter.id}')">Redigera</button>
                    <button class="btn btn-danger" onclick="deleteLetter('${letter.id}')">Ta bort</button>
                </div>
            </div>
            <div class="item-preview">${escapeHtml(letter.text)}</div>
        </div>
    `).join('');
}

function renderCases() {
    const list = document.getElementById('cases-list');
    if (state.caseTexts.length === 0) {
        list.innerHTML = '<div class="empty-state">Inga case-texter tillagda ännu.</div>';
        return;
    }
    list.innerHTML = state.caseTexts.map(c => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(c.title)}</div>
                    <div class="item-meta">${formatDate(c.date)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small" onclick="editCase('${c.id}')">Redigera</button>
                    <button class="btn btn-danger" onclick="deleteCase('${c.id}')">Ta bort</button>
                </div>
            </div>
            <div class="item-preview">${escapeHtml(c.text)}</div>
        </div>
    `).join('');
}

function renderJobs() {
    const list = document.getElementById('jobs-list');
    if (state.jobs.length === 0) {
        list.innerHTML = '<div class="empty-state">Inga jobb tillagda ännu. Klicka "Lägg till jobb" för att börja.</div>';
        return;
    }
    list.innerHTML = state.jobs.map(job => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(job.title)}</div>
                    <div class="item-company">${escapeHtml(job.company)}</div>
                    <div class="item-meta">${formatDate(job.date)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small" onclick="editJob('${job.id}')">Redigera</button>
                    <button class="btn btn-danger" onclick="deleteJob('${job.id}')">Ta bort</button>
                </div>
            </div>
            <div class="item-preview">${escapeHtml(job.description)}</div>
        </div>
    `).join('');
}

function renderGeneratedLetters() {
    const list = document.getElementById('generated-list');
    if (state.generatedLetters.length === 0) {
        list.innerHTML = '<div class="empty-state">Inga genererade brev sparade ännu.</div>';
        return;
    }
    list.innerHTML = state.generatedLetters.map(letter => `
        <div class="item-card">
            <div class="item-header">
                <div>
                    <div class="item-title">${escapeHtml(letter.jobTitle)}</div>
                    <div class="item-company">${escapeHtml(letter.jobCompany)}</div>
                    <div class="item-meta">${formatDate(letter.date)}</div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-secondary btn-small" onclick="viewGeneratedLetter('${letter.id}')">Visa</button>
                    <button class="btn btn-danger" onclick="deleteGeneratedLetter('${letter.id}')">Ta bort</button>
                </div>
            </div>
            <div class="item-preview">${escapeHtml(letter.text)}</div>
        </div>
    `).join('');
}

function renderDocuments() {
    const list = document.getElementById('docs-list');
    if (state.documents.length === 0) {
        list.innerHTML = '';
        return;
    }
    list.innerHTML = state.documents.map(doc => `
        <div class="file-card">
            <div class="file-thumb">
                ${doc.isImage
                    ? `<img src="${doc.data}" alt="${escapeHtml(doc.name)}">`
                    : `<span class="file-thumb-icon">${getFileIcon(doc.type)}</span>`
                }
            </div>
            <div class="file-card-name" title="${escapeHtml(doc.name)}">${escapeHtml(doc.name)}</div>
            <div class="file-card-size">${formatFileSize(doc.size)}</div>
            <div class="file-card-actions">
                <button class="btn btn-secondary btn-small" onclick="downloadDocument('${doc.id}')">Ladda ner</button>
                <button class="btn btn-danger" onclick="deleteDocument('${doc.id}')">Ta bort</button>
            </div>
        </div>
    `).join('');
}

function populateJobSelect() {
    const select = document.getElementById('job-select');
    const current = select.value;
    select.innerHTML = '<option value="">-- Välj ett jobb --</option>';
    state.jobs.forEach(job => {
        const option = document.createElement('option');
        option.value = job.id;
        option.textContent = `${job.title} - ${job.company}`;
        select.appendChild(option);
    });
    if (current) select.value = current;
}

// === VIEW GENERATED LETTER ===
function viewGeneratedLetter(id) {
    const letter = state.generatedLetters.find(l => l.id === id);
    if (!letter) return;

    // Navigate to generate tab and show the letter
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('[data-tab="generate"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-generate').classList.add('active');

    populateJobSelect();
    document.getElementById('generated-text').textContent = letter.text;
    document.getElementById('generated-result').classList.remove('hidden');
}

async function deleteGeneratedLetter(id) {
    state.generatedLetters = state.generatedLetters.filter(l => l.id !== id);
    await saveData('generated_letters', state.generatedLetters);
    renderGeneratedLetters();
}

// === UI HELPERS ===
function showForm(type) {
    const form = document.getElementById(`${type}-form`);
    form.classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (type === 'letter' && !state.editingLetterId) {
        document.getElementById('letter-title').value = '';
        document.getElementById('letter-text').value = '';
        document.getElementById('letter-form-title').textContent = 'Lägg till personligt brev';
    }
    if (type === 'case' && !state.editingCaseId) {
        document.getElementById('case-title').value = '';
        document.getElementById('case-text').value = '';
        document.getElementById('case-form-title').textContent = 'Lägg till case-text';
    }
    if (type === 'job' && !state.editingJobId) {
        document.getElementById('job-title').value = '';
        document.getElementById('job-company').value = '';
        document.getElementById('job-description').value = '';
        document.getElementById('job-form-title').textContent = 'Lägg till jobb';
    }
}

function hideForm(type) {
    document.getElementById(`${type}-form`).classList.add('hidden');
    if (type === 'letter') state.editingLetterId = null;
    if (type === 'case') state.editingCaseId = null;
    if (type === 'job') state.editingJobId = null;
}

function showStatus(id, message) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 2500);
}

// === UTILITIES ===
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
