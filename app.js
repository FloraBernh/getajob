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

    // Discover
    setupDiscoverListeners();

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

        const generatedText = extractAIText(response);
        document.getElementById('generated-text').textContent = generatedText;
        resultCard.classList.remove('hidden');
    } catch (e) {
        console.error('AI generation failed:', e);
        const errMsg = e?.message || e?.error || (typeof e === 'string' ? e : JSON.stringify(e));
        alert('Kunde inte generera brev. Kontrollera att du är inloggad och försök igen.\n\nFel: ' + errMsg);
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

// === DISCOVER JOBS ===
const PLATSBANKEN_API = 'https://jobsearch.api.jobtechdev.se';
const MUNICIPALITY_CODES = {
    stockholm: '0180',
    goteborg: '1480'
};

function setupDiscoverListeners() {
    document.getElementById('discover-btn').addEventListener('click', discoverJobs);
}

async function discoverJobs() {
    if (!state.cvText && state.coverLetters.length === 0) {
        alert('Lägg till ditt CV eller minst ett personligt brev under "Min profil" först, så att AI:n vet vad du söker!');
        return;
    }

    const btn = document.getElementById('discover-btn');
    const statusBox = document.getElementById('discover-status');
    const statusText = document.getElementById('discover-status-text');
    const resultsDiv = document.getElementById('discover-results');
    const externalDiv = document.getElementById('external-links');

    btn.disabled = true;
    statusBox.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    externalDiv.classList.add('hidden');

    const useStockholm = document.getElementById('loc-stockholm').checked;
    const useGoteborg = document.getElementById('loc-goteborg').checked;
    const extraWishes = document.getElementById('discover-extra').value.trim();

    try {
        // Step 1: AI analyzes profile and generates search terms
        statusText.textContent = 'Analyserar din profil...';
        const searchTerms = await analyzeProfileForSearch(extraWishes);

        // Step 2: Generate external search links
        statusText.textContent = 'Skapar söklänkar för LinkedIn och Indeed...';
        showExternalLinks(searchTerms, useStockholm, useGoteborg);
        externalDiv.classList.remove('hidden');

        // Step 3: Search Platsbanken
        statusText.textContent = 'Söker jobb på Platsbanken...';
        const municipalities = [];
        if (useStockholm) municipalities.push(MUNICIPALITY_CODES.stockholm);
        if (useGoteborg) municipalities.push(MUNICIPALITY_CODES.goteborg);

        const allJobs = [];
        for (const term of searchTerms.queries) {
            const jobs = await searchPlatsbanken(term, municipalities);
            allJobs.push(...jobs);
        }

        // Deduplicate by id
        const uniqueJobs = [...new Map(allJobs.map(j => [j.id, j])).values()];

        if (uniqueJobs.length === 0) {
            statusBox.classList.add('hidden');
            btn.disabled = false;
            resultsDiv.classList.remove('hidden');
            document.getElementById('discover-jobs-list').innerHTML =
                '<div class="empty-state">Inga jobb hittades just nu. Prova att uppdatera din profil eller ändra sökkriterier.</div>';
            return;
        }

        // Step 4: AI ranks and picks best matches
        statusText.textContent = `Hittade ${uniqueJobs.length} jobb. AI:n matchar mot din profil...`;
        const rankedJobs = await rankJobsWithAI(uniqueJobs.slice(0, 20), extraWishes);

        // Step 5: Show results
        resultsDiv.classList.remove('hidden');
        renderDiscoverJobs(rankedJobs);

    } catch (e) {
        console.error('Discover failed:', e);
        const errMsg = e?.message || e?.error || (typeof e === 'string' ? e : JSON.stringify(e));
        alert('Något gick fel vid jobbsökningen. Kontrollera att du är inloggad och försök igen.\n\nFel: ' + errMsg);
    } finally {
        btn.disabled = false;
        statusBox.classList.add('hidden');
    }
}

async function analyzeProfileForSearch(extraWishes) {
    let profileSummary = '';
    if (state.cvText) profileSummary += `CV:\n${state.cvText}\n\n`;
    state.coverLetters.forEach(l => {
        profileSummary += `Personligt brev "${l.title}":\n${l.text}\n\n`;
    });

    const prompt = `Analysera denna persons profil och generera söktermer för jobbsökning.

PROFIL:
${profileSummary}

${extraWishes ? `EXTRA ÖNSKEMÅL: ${extraWishes}` : ''}

Svara ENBART med JSON i detta format (inget annat):
{
  "queries": ["sökterm1", "sökterm2", "sökterm3"],
  "title": "kort sammanfattning av personens profil",
  "linkedin_keywords": "keywords for linkedin search",
  "indeed_keywords": "keywords for indeed search"
}

Generera 3-5 relevanta söktermer baserat på personens erfarenhet, kompetenser och bransch. Söktermer ska vara på svenska och engelska blandade, t.ex. "product manager", "projektledare", "digital strateg". Svara BARA med JSON.`;

    const response = await puter.ai.chat(prompt, { model: state.aiModel });
    const text = extractAIText(response);

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Kunde inte tolka AI-svaret: ' + text.substring(0, 100));
    return JSON.parse(jsonMatch[0]);
}

// Helper to reliably extract text from puter.ai.chat response
function extractAIText(response) {
    if (typeof response === 'string') return response;
    if (response?.message?.content) {
        const content = response.message.content;
        if (typeof content === 'string') return content;
        if (Array.isArray(content) && content[0]?.text) return content[0].text;
    }
    if (response?.text) return response.text;
    if (response?.content) return typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    return String(response);
}

async function searchPlatsbanken(query, municipalities) {
    const params = new URLSearchParams({
        q: query,
        limit: '10',
        sort: 'relevance'
    });
    municipalities.forEach(m => params.append('municipality', m));

    try {
        const response = await fetch(`${PLATSBANKEN_API}/search?${params}`);
        if (!response.ok) return [];
        const data = await response.json();
        return (data.hits || []).map(hit => ({
            id: hit.id,
            title: hit.headline,
            company: hit.employer?.name || 'Okänt företag',
            city: hit.workplace_address?.city || hit.workplace_address?.municipality || '',
            description: hit.description?.text || '',
            descriptionShort: (hit.description?.text || '').substring(0, 300),
            url: hit.application_details?.url || `https://arbetsformedlingen.se/platsbanken/annonser/${hit.id}`,
            deadline: hit.application_deadline,
            published: hit.publication_date,
            employmentType: hit.employment_type?.label || '',
            duration: hit.duration?.label || ''
        }));
    } catch (e) {
        console.error(`Platsbanken search failed for "${query}":`, e);
        return [];
    }
}

async function rankJobsWithAI(jobs, extraWishes) {
    let profileSummary = '';
    if (state.cvText) profileSummary += state.cvText.substring(0, 2000);

    const jobsList = jobs.map((j, i) => `[${i}] ${j.title} - ${j.company} (${j.city})\n${j.descriptionShort}...`).join('\n\n');

    const prompt = `Du är en karriärrådgivare. Analysera dessa jobb och ranka vilka som passar bäst för kandidaten.

KANDIDATENS CV (sammanfattning):
${profileSummary}

${extraWishes ? `EXTRA ÖNSKEMÅL: ${extraWishes}` : ''}

JOBB:
${jobsList}

Svara ENBART med JSON-array med index för de bästa jobben, rankade från bäst till sämst. Max 8 jobb. Format:
[{"index": 0, "reason": "kort förklaring varför detta matchar"}, ...]

Svara BARA med JSON-arrayen, inget annat.`;

    try {
        const response = await puter.ai.chat(prompt, { model: state.aiModel });
        const text = extractAIText(response);

        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return jobs.slice(0, 8).map(j => ({ ...j, matchReason: '' }));

        const ranked = JSON.parse(jsonMatch[0]);
        return ranked
            .filter(r => r.index >= 0 && r.index < jobs.length)
            .map(r => ({ ...jobs[r.index], matchReason: r.reason || '' }));
    } catch (e) {
        console.error('Ranking failed:', e);
        return jobs.slice(0, 8).map(j => ({ ...j, matchReason: '' }));
    }
}

function showExternalLinks(searchTerms, useStockholm, useGoteborg) {
    const locations = [];
    if (useStockholm) locations.push('Stockholm');
    if (useGoteborg) locations.push('Göteborg');
    const locationStr = locations.join(' OR ');

    const linkedinKeywords = encodeURIComponent(searchTerms.linkedin_keywords || searchTerms.queries[0]);
    const indeedKeywords = encodeURIComponent(searchTerms.indeed_keywords || searchTerms.queries[0]);
    const locationEncoded = encodeURIComponent(locations.join(', '));

    const links = [
        {
            name: 'LinkedIn Jobs',
            icon: '💼',
            url: `https://www.linkedin.com/jobs/search/?keywords=${linkedinKeywords}&location=${locationEncoded}`,
            desc: `Sök "${searchTerms.linkedin_keywords}" i ${locations.join(' och ')}`
        },
        {
            name: 'Indeed',
            icon: '🔵',
            url: `https://se.indeed.com/jobb?q=${indeedKeywords}&l=${locationEncoded}`,
            desc: `Sök "${searchTerms.indeed_keywords}" i ${locations.join(' och ')}`
        }
    ];

    // Add a link per search term for Platsbanken too
    searchTerms.queries.forEach(q => {
        const params = new URLSearchParams({ q });
        if (useStockholm) params.append('municipality', MUNICIPALITY_CODES.stockholm);
        if (useGoteborg) params.append('municipality', MUNICIPALITY_CODES.goteborg);
        links.push({
            name: 'Platsbanken',
            icon: '🇸🇪',
            url: `https://arbetsformedlingen.se/platsbanken/annonser?${params}`,
            desc: `Sök "${q}"`
        });
    });

    document.getElementById('external-links-list').innerHTML = links.map(link => `
        <a href="${link.url}" target="_blank" rel="noopener" class="external-link-card">
            <span class="external-link-icon">${link.icon}</span>
            <div class="external-link-info">
                <div class="external-link-name">${escapeHtml(link.name)}</div>
                <div class="external-link-desc">${escapeHtml(link.desc)}</div>
            </div>
            <span class="external-link-arrow">→</span>
        </a>
    `).join('');
}

function renderDiscoverJobs(jobs) {
    const list = document.getElementById('discover-jobs-list');
    if (jobs.length === 0) {
        list.innerHTML = '<div class="empty-state">Inga matchande jobb hittades.</div>';
        return;
    }

    list.innerHTML = jobs.map(job => `
        <div class="discover-job-card" id="discover-${job.id}">
            <div class="discover-job-header">
                <div>
                    <div class="discover-job-title">${escapeHtml(job.title)}</div>
                    <div class="discover-job-company">${escapeHtml(job.company)}</div>
                    <div class="discover-job-meta">
                        📍 ${escapeHtml(job.city)}
                        ${job.employmentType ? ' · ' + escapeHtml(job.employmentType) : ''}
                        ${job.deadline ? ' · Sista dag: ' + formatDate(job.deadline) : ''}
                    </div>
                </div>
                <a href="${job.url}" target="_blank" rel="noopener" class="btn btn-secondary btn-small">Visa annons →</a>
            </div>
            ${job.matchReason ? `<div class="discover-match-reason">✨ ${escapeHtml(job.matchReason)}</div>` : ''}
            <div class="discover-job-desc">${escapeHtml(job.descriptionShort)}...</div>
            <div class="discover-job-actions">
                <button class="btn btn-primary" onclick="generateDiscoverLetter('${job.id}', this)">✨ Generera personligt brev</button>
                <button class="btn btn-secondary" onclick="saveDiscoverJob('${job.id}')">💾 Spara till Mina jobb</button>
                <button class="btn btn-ghost" onclick="dismissDiscoverJob('${job.id}')">Inte intresserad</button>
            </div>
            <div class="discover-letter-result hidden" id="letter-${job.id}">
                <div class="discover-letter-header">
                    <h4>Genererat personligt brev</h4>
                    <div class="item-actions">
                        <button class="btn btn-secondary btn-small" onclick="copyDiscoverLetter('${job.id}')">Kopiera</button>
                    </div>
                </div>
                <div class="generated-text" id="letter-text-${job.id}"></div>
            </div>
        </div>
    `).join('');

    // Store jobs for later reference
    window._discoverJobs = jobs;
}

async function generateDiscoverLetter(jobId, btnEl) {
    const job = (window._discoverJobs || []).find(j => j.id === jobId);
    if (!job) return;

    btnEl.disabled = true;
    btnEl.textContent = 'Genererar...';

    const fakeJob = {
        title: job.title,
        company: job.company,
        description: job.description || job.descriptionShort
    };

    const prompt = buildPrompt(fakeJob, '');

    try {
        const response = await puter.ai.chat(prompt, { model: state.aiModel });
        const text = extractAIText(response);
        document.getElementById(`letter-text-${jobId}`).textContent = text;
        document.getElementById(`letter-${jobId}`).classList.remove('hidden');
    } catch (e) {
        console.error('Letter generation failed:', e);
        alert('Kunde inte generera brev. Försök igen.');
    } finally {
        btnEl.disabled = false;
        btnEl.textContent = '✨ Generera personligt brev';
    }
}

function copyDiscoverLetter(jobId) {
    const text = document.getElementById(`letter-text-${jobId}`).textContent;
    navigator.clipboard.writeText(text);
}

async function saveDiscoverJob(jobId) {
    const job = (window._discoverJobs || []).find(j => j.id === jobId);
    if (!job) return;

    // Check if already saved
    if (state.jobs.some(j => j.title === job.title && j.company === job.company)) {
        alert('Detta jobb finns redan i "Mina jobb".');
        return;
    }

    state.jobs.push({
        id: generateId(),
        title: job.title,
        company: job.company,
        description: job.description || job.descriptionShort,
        url: job.url,
        date: new Date().toISOString()
    });

    await saveData('jobs', state.jobs);
    renderJobs();
    alert(`"${job.title}" sparad till Mina jobb!`);
}

function dismissDiscoverJob(jobId) {
    const card = document.getElementById(`discover-${jobId}`);
    if (card) {
        card.style.opacity = '0.3';
        card.style.pointerEvents = 'none';
    }
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
    updateStats();
}

function updateStats() {
    document.getElementById('stat-cv').textContent = state.cvText ? '1' : '0';
    document.getElementById('stat-letters').textContent = state.coverLetters.length;
    document.getElementById('stat-cases').textContent = state.caseTexts.length;
    document.getElementById('stat-docs').textContent = state.documents.length;
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
