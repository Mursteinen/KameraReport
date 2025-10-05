// State management
let currentProjectId = null;
let currentProject = null;
let currentPackageId = null;
let currentLineId = null;
let currentRemarkId = null;
let currentEditPackageId = null;
let currentEditLineId = null;
let currentEditProjectId = null;

// OCR Configuration State
let ocrConfigState = {
    isConfiguring: false,
    pdfFile: null,
    imageData: null,
    canvas: null,
    ctx: null,
    regions: [],
    currentRegion: null,
    isDrawing: false,
    startX: 0,
    startY: 0
};

// DOM Elements
const projectsView = document.getElementById('projectsView');
const packagesView = document.getElementById('packagesView');
const packageDetailsView = document.getElementById('packageDetailsView');
const projectsList = document.getElementById('projectsList');
const packagesList = document.getElementById('packagesList');
const linesList = document.getElementById('linesList');

// Modals
const newProjectModal = document.getElementById('newProjectModal');
const newPackageModal = document.getElementById('newPackageModal');
const editPackageModal = document.getElementById('editPackageModal');
const newLineModal = document.getElementById('newLineModal');
const editLineModal = document.getElementById('editLineModal');
const newRemarkModal = document.getElementById('newRemarkModal');
const viewRemarkModal = document.getElementById('viewRemarkModal');

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadProjects();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // PDF Drop Zone
    setupPdfDropZone();
    
    // New Project
    document.getElementById('newProjectBtn').addEventListener('click', () => {
        openModal(newProjectModal);
    });

    document.getElementById('newProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectNumber = document.getElementById('projectNumber').value;
        const customerName = document.getElementById('customerName').value;
        
        try {
            await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectNumber, customerName })
            });
            closeModal(newProjectModal);
            document.getElementById('newProjectForm').reset();
            loadProjects();
        } catch (err) {
            alert('Feil ved opprettelse av prosjekt: ' + err.message);
        }
    });

    // Edit Project
    const editProjectModal = document.getElementById('editProjectModal');
    document.getElementById('editProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const projectNumber = document.getElementById('editProjectNumber').value;
        const customerName = document.getElementById('editCustomerName').value;
        
        try {
            await fetch(`/api/projects/${currentEditProjectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectNumber, customerName })
            });
            closeModal(editProjectModal);
            document.getElementById('editProjectForm').reset();
            loadProjects();
            alert('Prosjektet ble oppdatert!');
        } catch (err) {
            alert('Feil ved oppdatering av prosjekt: ' + err.message);
        }
    });

    // Delete Project from Edit Modal
    document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
        if (confirm('Er du sikker på at du vil slette dette prosjektet? Dette vil slette alle tilknyttede pakker, seksjoner og merknader.')) {
            try {
                await fetch(`/api/projects/${currentEditProjectId}`, {
                    method: 'DELETE'
                });
                closeModal(editProjectModal);
                document.getElementById('editProjectForm').reset();
                loadProjects();
            } catch (err) {
                alert('Feil ved sletting av prosjekt: ' + err.message);
            }
        }
    });

    // New Package
    document.getElementById('newPackageBtn').addEventListener('click', () => {
        // Display project info in modal
        if (currentProject) {
            document.getElementById('modalProjectInfo').innerHTML = `
                <p><strong>Prosjekt:</strong> ${escapeHtml(currentProject.project_number)} - ${escapeHtml(currentProject.customer_name)}</p>
            `;
        }
        openModal(newPackageModal);
    });

    document.getElementById('newPackageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('packageName').value;
        const comment = document.getElementById('packageCommentInput').value;
        const pipeType = document.getElementById('pipeType').value;
        const lining = document.getElementById('lining').value;
        
        try {
            await fetch(`/api/projects/${currentProjectId}/packages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, comment, pipeType, lining })
            });
            closeModal(newPackageModal);
            document.getElementById('newPackageForm').reset();
            loadPackages(currentProjectId);
        } catch (err) {
            alert('Feil ved opprettelse av pakke: ' + err.message);
        }
    });

    // Edit Line
    document.getElementById('editLineForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editLineName').value;
        const lineNumber = document.getElementById('editLineNumber').value;
        
        console.log('DEBUG: Submitting edit line form');
        console.log('DEBUG: Line ID:', currentEditLineId);
        console.log('DEBUG: New name:', name);
        console.log('DEBUG: New lineNumber:', lineNumber);
        
        try {
            const response = await fetch(`/api/lines/${currentEditLineId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, lineNumber })
            });
            
            console.log('DEBUG: Response status:', response.status);
            const result = await response.json();
            console.log('DEBUG: Response data:', result);
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            closeModal(editLineModal);
            document.getElementById('editLineForm').reset();
            
            console.log('DEBUG: Reloading package details...');
            await loadPackageDetails(currentPackageId);
            
            alert('Rørseksjonen ble oppdatert!');
        } catch (err) {
            console.error('DEBUG: Error updating line:', err);
            alert('Feil ved oppdatering av rørseksjon: ' + err.message);
        }
    });

    // Edit Package
    document.getElementById('editPackageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('editPackageName').value;
        const comment = document.getElementById('editPackageCommentInput').value;
        const pipeType = document.getElementById('editPipeType').value;
        const lining = document.getElementById('editLining').value;
        
        try {
            await fetch(`/api/packages/${currentEditPackageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, comment, pipeType, lining })
            });
            closeModal(editPackageModal);
            document.getElementById('editPackageForm').reset();
            loadPackages(currentProjectId);
            alert('Pakken ble oppdatert!');
        } catch (err) {
            alert('Feil ved oppdatering av pakke: ' + err.message);
        }
    });

    // Export project
    document.getElementById('exportProjectBtn').addEventListener('click', async () => {
        if (!currentProjectId) {
            alert('Ingen prosjekt valgt');
            return;
        }
        
        try {
            const response = await fetch(`/api/projects/${currentProjectId}/export`);
            if (!response.ok) {
                throw new Error('Feil ved eksport av prosjekt');
            }
            
            // Get filename from Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = `project_${currentProjectId}_export.zip`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            showToast('Prosjekt eksportert som ZIP med alle filer!');
        } catch (err) {
            showToast('Feil ved eksport av prosjekt: ' + err.message, 'error');
        }
    });
    
    // Import project
    document.getElementById('importProjectBtn').addEventListener('click', () => {
        document.getElementById('importProjectFile').click();
    });
    
    document.getElementById('importProjectFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Check if it's a ZIP file
        if (!file.name.endsWith('.zip')) {
            alert('Vennligst velg en ZIP-fil eksportert fra systemet');
            e.target.value = '';
            return;
        }
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/api/projects/import', {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            if (response.ok) {
                alert(result.message || 'Prosjekt importert!');
                loadProjects();
            } else {
                throw new Error(result.error || 'Feil ved import');
            }
        } catch (err) {
            alert('Feil ved import av prosjekt: ' + err.message);
        }
        
        e.target.value = ''; // Reset input
    });
    
    // Export package
    document.getElementById('exportPackageBtn').addEventListener('click', async () => {
        if (!currentPackageId) {
            alert('Ingen pakke valgt');
            return;
        }
        
        try {
            const response = await fetch(`/api/packages/${currentPackageId}/export`);
            if (!response.ok) {
                throw new Error('Feil ved eksport av pakke');
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `package_${currentPackageId}_export.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            alert('Pakke eksportert! Du kan importere denne filen senere.');
        } catch (err) {
            alert('Feil ved eksport av pakke: ' + err.message);
        }
    });
    
    // Import package
    document.getElementById('importPackageBtn').addEventListener('click', () => {
        if (!currentProjectId) {
            alert('Velg et prosjekt først');
            return;
        }
        document.getElementById('importPackageFile').click();
    });
    
    document.getElementById('importPackageFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        if (!currentProjectId) {
            alert('Velg et prosjekt først');
            return;
        }
        
        try {
            const text = await file.text();
            const importData = JSON.parse(text);
            
            const response = await fetch(`/api/projects/${currentProjectId}/packages/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(importData)
            });
            
            const result = await response.json();
            if (response.ok) {
                alert(result.message || 'Pakke importert!');
                loadPackages(currentProjectId);
            } else {
                throw new Error(result.error || 'Feil ved import');
            }
        } catch (err) {
            alert('Feil ved import av pakke: ' + err.message);
        }
        
        e.target.value = ''; // Reset input
    });

    // Print all packages in project
    document.getElementById('printAllPackagesBtn').addEventListener('click', async () => {
        if (!currentProjectId) {
            alert('Ingen prosjekt valgt');
            return;
        }
        
        try {
            const response = await fetch(`/api/projects/${currentProjectId}/generate-report`);
            if (!response.ok) {
                throw new Error('Feil ved generering av prosjektrapport');
            }
            
            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'prosjektrapport.zip';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('Feil ved generering av prosjektrapport: ' + err.message);
        }
    });

    // Back to projects
    document.getElementById('backToProjectsBtn').addEventListener('click', () => {
        showView('projects');
    });

    // Back to packages
    document.getElementById('backToPackagesBtn').addEventListener('click', () => {
        showView('packages');
    });

    // Generate PDF report
    document.getElementById('printReportBtn').addEventListener('click', async () => {
        try {
            const response = await fetch(`/api/packages/${currentPackageId}/generate-report`);
            if (!response.ok) {
                throw new Error('Feil ved generering av rapport');
            }
            
            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'rapport.pdf';
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            alert('Feil ved generering av PDF-rapport: ' + err.message);
        }
    });

    // Save package comment
    document.getElementById('savePackageCommentBtn').addEventListener('click', async () => {
        const comment = document.getElementById('packageComment').value;
        try {
            await fetch(`/api/packages/${currentPackageId}/comment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment })
            });
            alert('Kommentar lagret!');
        } catch (err) {
            alert('Feil ved lagring av kommentar: ' + err.message);
        }
    });

    // New Line
    document.getElementById('newLineBtn').addEventListener('click', () => {
        openModal(newLineModal);
    });

    document.getElementById('newLineForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('name', document.getElementById('lineName').value);
        formData.append('lineNumber', document.getElementById('lineNumber').value);
        
        const pdfFile = document.getElementById('pdfFile').files[0];
        if (pdfFile) {
            formData.append('pdf', pdfFile);
        }

        try {
            const response = await fetch(`/api/packages/${currentPackageId}/lines`, {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            
            closeModal(newLineModal);
            document.getElementById('newLineForm').reset();
            loadPackageDetails(currentPackageId);
            
            // Show message if PDF was split into multiple pages
            if (result.multiple) {
                alert(`PDF-en ble delt opp i ${result.count} separate rørseksjoner (én per side).`);
            }
        } catch (err) {
            alert('Feil ved tilføyelse av seksjon: ' + err.message);
        }
    });

    // New Remark
    document.getElementById('remarkImage').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                document.getElementById('imagePreview').innerHTML = 
                    `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('newRemarkForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData();
        formData.append('image', document.getElementById('remarkImage').files[0]);
        formData.append('comment', document.getElementById('remarkComment').value);

        try {
            await fetch(`/api/lines/${currentLineId}/remarks`, {
                method: 'POST',
                body: formData
            });
            closeModal(newRemarkModal);
            document.getElementById('newRemarkForm').reset();
            document.getElementById('imagePreview').innerHTML = '';
            loadPackageDetails(currentPackageId);
        } catch (err) {
            alert('Feil ved tilføyelse av merknad: ' + err.message);
        }
    });

    // Edit Remark
    document.getElementById('saveRemarkCommentBtn').addEventListener('click', async () => {
        const comment = document.getElementById('editRemarkComment').value;
        try {
            await fetch(`/api/remarks/${currentRemarkId}/comment`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ comment })
            });
            closeModal(viewRemarkModal);
            loadPackageDetails(currentPackageId);
            alert('Kommentar oppdatert!');
        } catch (err) {
            alert('Feil ved oppdatering av kommentar: ' + err.message);
        }
    });

    // Delete Remark
    document.getElementById('deleteRemarkBtn').addEventListener('click', async () => {
        if (confirm('Er du sikker på at du vil slette denne merknaden?')) {
            try {
                await fetch(`/api/remarks/${currentRemarkId}`, {
                    method: 'DELETE'
                });
                closeModal(viewRemarkModal);
                loadPackageDetails(currentPackageId);
            } catch (err) {
                alert('Feil ved sletting av merknad: ' + err.message);
            }
        }
    });

    // PDF navigation buttons
    document.getElementById('pdfPrevBtn').addEventListener('click', navigatePdfPrev);
    document.getElementById('pdfNextBtn').addEventListener('click', navigatePdfNext);
    
    // Modal close handlers
    document.querySelectorAll('.cancel-btn, .close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            closeModal(modal);
        });
    });

    // Close modal on background click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });
}

// Load all projects
async function loadProjects() {
    try {
        const response = await fetch('/api/projects');
        const projects = await response.json();
        
        if (projects.length === 0) {
            projectsList.innerHTML = `
                <div class="empty-state">
                    <p>Ingen prosjekter ennå</p>
                    <button class="btn btn-primary" onclick="document.getElementById('newProjectBtn').click()">
                        Opprett ditt første prosjekt
                    </button>
                </div>
            `;
        } else {
            projectsList.innerHTML = projects.map(project => `
                <div class="package-card">
                    <h3>${escapeHtml(project.project_number)}</h3>
                    <div class="comment">${escapeHtml(project.customer_name)}</div>
                    <div class="date">Opprettet: ${formatNorwegianDate(project.created_at)}</div>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="viewProject(${project.id})">Se pakker</button>
                        <button class="btn btn-secondary" onclick="editProject(${project.id})">Rediger</button>
                    </div>
                </div>
            `).join('');
        }
        updateBreadcrumb('projects');
    } catch (err) {
        projectsList.innerHTML = '<p>Feil ved lasting av prosjekter</p>';
    }
}

// Load all packages for a project
async function loadPackages(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/packages`);
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server error');
        }
        
        const packages = await response.json();
        
        if (packages.length === 0) {
            packagesList.innerHTML = `
                <div class="empty-state">
                    <p>Ingen testpakker ennå</p>
                    <button class="btn btn-primary" onclick="document.getElementById('newPackageBtn').click()">
                        Opprett din første pakke
                    </button>
                </div>
            `;
        } else {
            // Sort packages with natural sorting (handles numbers correctly)
            packages.sort((a, b) => {
                return a.name.localeCompare(b.name, 'nb-NO', { numeric: true, sensitivity: 'base' });
            });
            
            packagesList.innerHTML = packages.map(pkg => `
                <div class="package-card">
                    <h3>${escapeHtml(pkg.name)}</h3>
                    ${pkg.pipe_type || pkg.lining ? `
                        <div class="package-specs">
                            ${pkg.pipe_type ? `<span class="spec-badge">Rør: ${escapeHtml(pkg.pipe_type)}</span>` : ''}
                            ${pkg.lining ? `<span class="spec-badge">Lining: ${escapeHtml(pkg.lining)}</span>` : ''}
                        </div>
                    ` : ''}
                    ${pkg.comment ? `<div class="comment">"${escapeHtml(pkg.comment)}"</div>` : ''}
                    <div class="date">Opprettet: ${formatNorwegianDate(pkg.created_at)}</div>
                    <div class="actions">
                        <button class="btn btn-primary" onclick="viewPackage(${pkg.id})">Se detaljer</button>
                        <button class="btn btn-secondary" onclick="editPackage(${pkg.id})">Rediger</button>
                        <button class="btn btn-danger" onclick="deletePackage(${pkg.id})">Slett</button>
                    </div>
                </div>
            `).join('');
        }
        updateBreadcrumb('packages');
    } catch (err) {
        console.error('Error loading packages:', err);
        packagesList.innerHTML = `<p>Feil ved lasting av pakker: ${err.message}</p>`;
    }
}

// Load package details
async function loadPackageDetails(packageId) {
    try {
        const response = await fetch(`/api/packages/${packageId}`);
        const pkg = await response.json();
        
        currentPackageId = packageId;
        document.getElementById('packageTitle').textContent = pkg.name;
        document.getElementById('packageComment').value = pkg.comment || '';
        
        // Generate print summary
        generatePrintSummary(pkg);
        
        if (pkg.pdfLines.length === 0) {
            linesList.innerHTML = `
                <div class="empty-state">
                    <p>Ingen rørseksjoner ennå</p>
                </div>
            `;
        } else {
            linesList.innerHTML = pkg.pdfLines.map(line => {
                const remarksHtml = line.remarks.length > 0 ? `
                    <div class="remarks-section">
                        <h5>Merknader (${line.remarks.length})</h5>
                        <div class="remarks-grid">
                            ${line.remarks.map(remark => `
                                <div class="remark-card" onclick="viewRemark(${remark.id}, '${remark.image_path}', '${escapeHtml(remark.comment || '')}')">
                                    <img src="${remark.image_path}" alt="Remark">
                                    ${remark.comment ? `<div class="comment">${escapeHtml(remark.comment)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : '<p style="color: #999; font-size: 0.9em;">Ingen merknader ennå</p>';

                return `
                    <div class="line-card" data-line-id="${line.id}">
                        <div class="line-header">
                            <h4>${escapeHtml(line.name)}</h4>
                            <span class="line-number">Seksjon ${line.line_number}</span>
                        </div>
                        ${line.pdf_path ? `
                            <a href="#" onclick="viewPdf('${line.pdf_path}', '${escapeHtml(line.name)}'); return false;" class="pdf-link">Se ISO-tegning</a>
                            <div class="pdf-embed-container">
                                <iframe src="${line.pdf_path}" class="pdf-embed"></iframe>
                            </div>
                        ` : ''}
                        <div class="line-actions">
                            <button class="btn btn-primary" onclick="addRemark(${line.id})">+ Legg til merknad</button>
                            <button class="btn btn-secondary" onclick="editLine(${line.id}, '${escapeHtml(line.name)}', ${line.line_number})">Rediger</button>
                            <button class="btn btn-danger" onclick="deleteLine(${line.id})">Slett seksjon</button>
                        </div>
                        ${remarksHtml}
                    </div>
                `;
            }).join('');
        }
        
        showView('details');
        
        // Setup drag and drop for remarks after lines are rendered
        setupRemarkDropZones();
    } catch (err) {
        alert('Feil ved lasting av pakkedetaljer: ' + err.message);
    }
}

// Setup drag and drop for remark images on line cards
function setupRemarkDropZones() {
    const lineCards = document.querySelectorAll('.line-card[data-line-id]');
    
    lineCards.forEach(card => {
        const lineId = card.getAttribute('data-line-id');
        
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            card.addEventListener(eventName, preventDefaults, false);
        });
        
        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        // Highlight drop zone when image is dragged over it
        card.addEventListener('dragenter', () => {
            card.classList.add('drag-over-remark');
        });
        
        card.addEventListener('dragover', () => {
            card.classList.add('drag-over-remark');
        });
        
        card.addEventListener('dragleave', (e) => {
            // Only remove highlight if leaving the card completely
            if (e.target === card) {
                card.classList.remove('drag-over-remark');
            }
        });
        
        card.addEventListener('drop', async (e) => {
            card.classList.remove('drag-over-remark');
            
            const files = e.dataTransfer.files;
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            
            if (imageFiles.length === 0) {
                alert('Vennligst dra et bilde (JPG, PNG, etc.)');
                return;
            }
            
            // Upload all dropped images as remarks for this line
            for (const file of imageFiles) {
                await uploadRemarkImage(lineId, file);
            }
            
            // Reload to show new remarks
            loadPackageDetails(currentPackageId);
        });
    });
}

// Upload remark image directly
async function uploadRemarkImage(lineId, imageFile) {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('comment', ''); // Empty comment, can be added later
    
    try {
        await fetch(`/api/lines/${lineId}/remarks`, {
            method: 'POST',
            body: formData
        });
    } catch (err) {
        console.error('Error uploading remark:', err);
        alert('Feil ved opplasting av merknad: ' + err.message);
    }
}

// View project
async function viewProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        currentProject = await response.json();
        currentProjectId = projectId;
        
        document.getElementById('projectTitle').textContent = `${currentProject.project_number} - ${currentProject.customer_name}`;
        
        loadPackages(projectId);
        showView('packages');
    } catch (err) {
        alert('Feil ved lasting av prosjekt: ' + err.message);
    }
}

// View package
function viewPackage(packageId) {
    loadPackageDetails(packageId);
}

// Edit project
async function editProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`);
        const project = await response.json();
        
        currentEditProjectId = projectId;
        
        // Populate form with current values
        document.getElementById('editProjectNumber').value = project.project_number;
        document.getElementById('editCustomerName').value = project.customer_name;
        
        const editProjectModal = document.getElementById('editProjectModal');
        openModal(editProjectModal);
    } catch (err) {
        alert('Feil ved lasting av prosjekt: ' + err.message);
    }
}

// Delete project
async function deleteProject(projectId) {
    if (confirm('Er du sikker på at du vil slette dette prosjektet? Dette vil slette alle tilknyttede pakker, seksjoner og merknader.')) {
        try {
            await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            });
            loadProjects();
        } catch (err) {
            alert('Feil ved sletting av prosjekt: ' + err.message);
        }
    }
}

// Delete package
async function deletePackage(packageId) {
    if (confirm('Er du sikker på at du vil slette denne pakken? Dette vil slette alle tilknyttede seksjoner og merknader.')) {
        try {
            await fetch(`/api/packages/${packageId}`, {
                method: 'DELETE'
            });
            loadPackages(currentProjectId);
        } catch (err) {
            alert('Feil ved sletting av pakke: ' + err.message);
        }
    }
}

// Delete line
async function deleteLine(lineId) {
    if (confirm('Er du sikker på at du vil slette denne rørseksjonen? Dette vil slette alle tilknyttede merknader.')) {
        try {
            await fetch(`/api/lines/${lineId}`, {
                method: 'DELETE'
            });
            loadPackageDetails(currentPackageId);
        } catch (err) {
            alert('Feil ved sletting av seksjon: ' + err.message);
        }
    }
}

// Add remark
function addRemark(lineId) {
    currentLineId = lineId;
    openModal(newRemarkModal);
}

// View remark
function viewRemark(remarkId, imagePath, comment) {
    currentRemarkId = remarkId;
    document.getElementById('remarkImageView').innerHTML = `<img src="${imagePath}" alt="Remark">`;
    document.getElementById('editRemarkComment').value = comment;
    openModal(viewRemarkModal);
}

// PDF Gallery state
let pdfGallery = {
    pdfs: [],
    currentIndex: 0
};

// View PDF in modal with gallery support
function viewPdf(pdfPath, lineName) {
    // Build gallery from current package's PDFs
    const response = fetch(`/api/packages/${currentPackageId}`)
        .then(res => res.json())
        .then(pkg => {
            pdfGallery.pdfs = pkg.pdfLines
                .filter(line => line.pdf_path)
                .map(line => ({
                    path: line.pdf_path,
                    name: line.name
                }));
            
            // Find current PDF index
            pdfGallery.currentIndex = pdfGallery.pdfs.findIndex(pdf => pdf.path === pdfPath);
            if (pdfGallery.currentIndex === -1) pdfGallery.currentIndex = 0;
            
            // Show PDF viewer
            showPdfInGallery();
            openModal(document.getElementById('pdfViewerModal'));
            
            // Setup keyboard navigation
            setupPdfKeyboardNav();
        });
}

// Show PDF at current index
function showPdfInGallery() {
    if (pdfGallery.pdfs.length === 0) return;
    
    const currentPdf = pdfGallery.pdfs[pdfGallery.currentIndex];
    document.getElementById('pdfViewerTitle').textContent = `ISO-tegning: ${currentPdf.name}`;
    document.getElementById('pdfViewerFrame').src = currentPdf.path;
    document.getElementById('pdfViewerCounter').textContent = 
        `${pdfGallery.currentIndex + 1} / ${pdfGallery.pdfs.length}`;
    
    // Update navigation buttons
    const prevBtn = document.getElementById('pdfPrevBtn');
    const nextBtn = document.getElementById('pdfNextBtn');
    
    prevBtn.disabled = pdfGallery.currentIndex === 0;
    nextBtn.disabled = pdfGallery.currentIndex === pdfGallery.pdfs.length - 1;
}

// Navigate to previous PDF
function navigatePdfPrev() {
    if (pdfGallery.currentIndex > 0) {
        pdfGallery.currentIndex--;
        showPdfInGallery();
    }
}

// Navigate to next PDF
function navigatePdfNext() {
    if (pdfGallery.currentIndex < pdfGallery.pdfs.length - 1) {
        pdfGallery.currentIndex++;
        showPdfInGallery();
    }
}

// Setup keyboard navigation for PDF gallery
let pdfKeyboardHandler = null;

function setupPdfKeyboardNav() {
    // Remove existing handler if any
    if (pdfKeyboardHandler) {
        document.removeEventListener('keydown', pdfKeyboardHandler);
    }
    
    // Create new handler
    pdfKeyboardHandler = (e) => {
        const modal = document.getElementById('pdfViewerModal');
        if (!modal.classList.contains('active')) return;
        
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            navigatePdfPrev();
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            navigatePdfNext();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeModal(modal);
        }
    };
    
    document.addEventListener('keydown', pdfKeyboardHandler);
}

// View switching
function showView(view) {
    projectsView.classList.remove('active');
    packagesView.classList.remove('active');
    packageDetailsView.classList.remove('active');
    
    if (view === 'projects') {
        projectsView.classList.add('active');
        currentProjectId = null;
        currentProject = null;
        loadProjects();
    } else if (view === 'packages') {
        packagesView.classList.add('active');
        updateBreadcrumb('packages');
    } else if (view === 'details') {
        packageDetailsView.classList.add('active');
        updateBreadcrumb('details');
    }
}

// Update breadcrumb navigation
function updateBreadcrumb(view) {
    const breadcrumb = document.getElementById('breadcrumb');
    
    if (view === 'projects') {
        breadcrumb.innerHTML = '<span class="breadcrumb-item active">Prosjekter</span>';
    } else if (view === 'packages') {
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" onclick="showView('projects')" style="cursor: pointer;">Prosjekter</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item active">${currentProject ? escapeHtml(currentProject.project_number) : 'Pakker'}</span>
        `;
    } else if (view === 'details') {
        const packageName = document.getElementById('packageTitle').textContent;
        breadcrumb.innerHTML = `
            <span class="breadcrumb-item" onclick="showView('projects')" style="cursor: pointer;">Prosjekter</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item" onclick="showView('packages')" style="cursor: pointer;">${currentProject ? escapeHtml(currentProject.project_number) : 'Pakker'}</span>
            <span class="breadcrumb-separator">›</span>
            <span class="breadcrumb-item active">${escapeHtml(packageName)}</span>
        `;
    }
}

// Modal helpers
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// Generate print summary
function generatePrintSummary(pkg) {
    const summaryContent = document.getElementById('summaryContent');
    const totalSections = pkg.pdfLines.length;
    const totalRemarks = pkg.pdfLines.reduce((sum, line) => sum + line.remarks.length, 0);
    
    let summaryHTML = `
        <div class="summary-info">
            <strong>Pakkenavn:</strong> <span>${escapeHtml(pkg.name)}</span>
            <strong>Dato:</strong> <span>${formatNorwegianDate(pkg.created_at)}</span>
            ${pkg.pipe_type ? `<strong>Type rør:</strong> <span>${escapeHtml(pkg.pipe_type)}</span>` : ''}
            ${pkg.lining ? `<strong>Lining:</strong> <span>${escapeHtml(pkg.lining)}</span>` : ''}
            <strong>Totalt antall rørseksjoner:</strong> <span>${totalSections}</span>
            <strong>Totalt antall merknader:</strong> <span>${totalRemarks}</span>
        </div>
    `;
    
    if (pkg.comment) {
        summaryHTML += `
            <div class="summary-info">
                <strong>Pakkekommentar:</strong> <span>${escapeHtml(pkg.comment)}</span>
            </div>
        `;
    }
    
    if (pkg.pdfLines.length > 0) {
        summaryHTML += `
            <table class="summary-table">
                <thead>
                    <tr>
                        <th>Seksjon #</th>
                        <th>Seksjonsnavn</th>
                        <th>ISO-tegning</th>
                        <th>Merknader</th>
                    </tr>
                </thead>
                <tbody>
                    ${pkg.pdfLines.map(line => `
                        <tr>
                            <td>${line.line_number}</td>
                            <td>${escapeHtml(line.name)}</td>
                            <td>${line.pdf_path ? 'Ja' : 'Nei'}</td>
                            <td>${line.remarks.length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
    
    summaryContent.innerHTML = summaryHTML;
}

// Format date in Norwegian format (DD.MM.YYYY)
function formatNorwegianDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Edit line
function editLine(lineId, lineName, lineNumber) {
    console.log('DEBUG: editLine called with:', { lineId, lineName, lineNumber });
    currentEditLineId = lineId;
    
    // Populate form with current values
    document.getElementById('editLineName').value = lineName;
    document.getElementById('editLineNumber').value = lineNumber;
    
    console.log('DEBUG: Opening edit line modal');
    openModal(editLineModal);
}

// Edit package
async function editPackage(packageId) {
    try {
        const response = await fetch(`/api/packages/${packageId}`);
        const pkg = await response.json();
        
        currentEditPackageId = packageId;
        
        // Populate form with current values
        document.getElementById('editPackageName').value = pkg.name;
        document.getElementById('editPipeType').value = pkg.pipe_type || '';
        document.getElementById('editLining').value = pkg.lining || '';
        document.getElementById('editPackageCommentInput').value = pkg.comment || '';
        
        openModal(editPackageModal);
    } catch (err) {
        alert('Feil ved lasting av pakke: ' + err.message);
    }
}

// Setup PDF Drop Zone
function setupPdfDropZone() {
    const dropZone = document.getElementById('pdfDropZone');
    const fileInput = document.getElementById('pdfDropInput');
    
    if (!dropZone || !fileInput) return;
    
    // Click to open file selector
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    // Handle file selection via input
    fileInput.addEventListener('change', (e) => {
        handlePdfFiles(e.target.files);
        fileInput.value = ''; // Reset input
    });
    
    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('drag-over');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('drag-over');
        }, false);
    });
    
    // Handle dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handlePdfFiles(files);
    }, false);
}

// Handle PDF files (single or multiple)
async function handlePdfFiles(files) {
    const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length === 0) {
        alert('Vennligst velg kun PDF-filer');
        return;
    }
    
    if (pdfFiles.length === 1) {
        // Single file: Open modal for user to enter details
        handleSinglePdfFile(pdfFiles[0]);
    } else {
        // Multiple files: Auto-create sections
        handleMultiplePdfFiles(pdfFiles);
    }
}

// Handle single PDF file - check if OCR config needed first
async function handleSinglePdfFile(file) {
    // Check if this package needs OCR configuration
    try {
        const response = await fetch(`/api/packages/${currentPackageId}/ocr-config`);
        const data = await response.json();
        
        // If package has no lines and no OCR config, show OCR config modal
        const pkgResponse = await fetch(`/api/packages/${currentPackageId}`);
        const pkg = await pkgResponse.json();
        
        if (pkg.pdfLines.length === 0 && !data.hasConfig) {
            // First PDF - show OCR configuration modal
            initOCRConfig(file);
        } else {
            // Package already configured or has lines - use normal upload
            const fileName = file.name.replace('.pdf', '');
            document.getElementById('lineName').value = fileName;
            
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            document.getElementById('pdfFile').files = dataTransfer.files;
            
            openModal(newLineModal);
        }
    } catch (err) {
        console.error('Error checking OCR config:', err);
        // Fallback to normal upload
        const fileName = file.name.replace('.pdf', '');
        document.getElementById('lineName').value = fileName;
        
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        document.getElementById('pdfFile').files = dataTransfer.files;
        
        openModal(newLineModal);
    }
}

// Handle multiple PDF files - auto-create sections
async function handleMultiplePdfFiles(files) {
    const response = await fetch(`/api/packages/${currentPackageId}`);
    const pkg = await response.json();
    const existingLines = pkg.pdfLines.length;
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = file.name.replace('.pdf', '');
        const lineNumber = existingLines + i + 1;
        
        const formData = new FormData();
        formData.append('name', fileName);
        formData.append('lineNumber', lineNumber);
        formData.append('pdf', file);
        
        try {
            await fetch(`/api/packages/${currentPackageId}/lines`, {
                method: 'POST',
                body: formData
            });
            successCount++;
        } catch (err) {
            console.error(`Feil ved opplasting av ${file.name}:`, err);
            failCount++;
        }
    }
    
    // Reload package details to show new sections
    loadPackageDetails(currentPackageId);
    
    // Show result message
    if (failCount === 0) {
        alert(`${successCount} rør${successCount > 1 ? 'seksjoner' : 'seksjon'} ble lagt til!`);
    } else {
        alert(`${successCount} rørseksjon(er) ble lagt til, ${failCount} feilet.`);
    }
}

// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Toast notification system
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'warning' ? 'toast-warning' : ''}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠';
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => {
            if (toast.parentNode) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ========== OCR CONFIGURATION FUNCTIONS ==========

// Initialize OCR configuration modal
async function initOCRConfig(pdfFile) {
    const ocrModal = document.getElementById('ocrConfigModal');
    ocrConfigState.pdfFile = pdfFile;
    ocrConfigState.regions = [];
    ocrConfigState.canvas = document.getElementById('ocrCanvas');
    ocrConfigState.ctx = ocrConfigState.canvas.getContext('2d');
    
    // Convert PDF first page to image for display
    const formData = new FormData();
    formData.append('pdf', pdfFile);
    
    try {
        const response = await fetch('/api/pdf-to-image', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Failed to convert PDF');
        
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        
        const img = new Image();
        img.onload = () => {
            // Set canvas size to image size
            ocrConfigState.canvas.width = img.width;
            ocrConfigState.canvas.height = img.height;
            
            // Draw image on canvas
            ocrConfigState.ctx.drawImage(img, 0, 0);
            ocrConfigState.imageData = ocrConfigState.ctx.getImageData(0, 0, img.width, img.height);
            
            // Setup canvas event listeners
            setupOCRCanvasEvents();
            
            // Show modal
            openModal(ocrModal);
            
            URL.revokeObjectURL(imageUrl);
        };
        img.src = imageUrl;
        
    } catch (err) {
        console.error('Error loading PDF for OCR config:', err);
        alert('Feil ved lasting av PDF for OCR-konfigurasjon');
    }
}

// Setup OCR canvas drawing events
function setupOCRCanvasEvents() {
    const canvas = ocrConfigState.canvas;
    
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);
    
    // OCR control buttons
    document.getElementById('ocrResetBtn').onclick = resetOCRRegions;
    document.getElementById('ocrSkipBtn').onclick = skipOCRConfig;
    document.getElementById('ocrSaveBtn').onclick = saveOCRConfig;
}

function startDrawing(e) {
    if (ocrConfigState.regions.length >= 2) return;
    
    const rect = ocrConfigState.canvas.getBoundingClientRect();
    ocrConfigState.isDrawing = true;
    ocrConfigState.startX = e.clientX - rect.left;
    ocrConfigState.startY = e.clientY - rect.top;
}

function draw(e) {
    if (!ocrConfigState.isDrawing) return;
    
    const rect = ocrConfigState.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Redraw image and existing regions
    redrawCanvas();
    
    // Draw current rectangle
    const width = currentX - ocrConfigState.startX;
    const height = currentY - ocrConfigState.startY;
    const color = ocrConfigState.regions.length === 0 ? 'rgba(33, 150, 243, 0.3)' : 'rgba(76, 175, 80, 0.3)';
    const borderColor = ocrConfigState.regions.length === 0 ? '#2196F3' : '#4CAF50';
    
    ocrConfigState.ctx.fillStyle = color;
    ocrConfigState.ctx.fillRect(ocrConfigState.startX, ocrConfigState.startY, width, height);
    ocrConfigState.ctx.strokeStyle = borderColor;
    ocrConfigState.ctx.lineWidth = 2;
    ocrConfigState.ctx.strokeRect(ocrConfigState.startX, ocrConfigState.startY, width, height);
}

function stopDrawing(e) {
    if (!ocrConfigState.isDrawing) return;
    
    const rect = ocrConfigState.canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    const x = Math.min(ocrConfigState.startX, endX);
    const y = Math.min(ocrConfigState.startY, endY);
    const width = Math.abs(endX - ocrConfigState.startX);
    const height = Math.abs(endY - ocrConfigState.startY);
    
    // Only save if region has meaningful size
    if (width > 20 && height > 20) {
        const regionType = ocrConfigState.regions.length === 0 ? 'documentId' : 'sheet';
        ocrConfigState.regions.push({ x, y, width, height, type: regionType });
        
        // Update status text
        updateOCRStatus();
        
        // Enable save button if both regions are defined
        if (ocrConfigState.regions.length === 2) {
            document.getElementById('ocrSaveBtn').disabled = false;
        }
    }
    
    ocrConfigState.isDrawing = false;
    redrawCanvas();
}

function redrawCanvas() {
    // Redraw original image
    ocrConfigState.ctx.putImageData(ocrConfigState.imageData, 0, 0);
    
    // Redraw all saved regions
    ocrConfigState.regions.forEach((region, index) => {
        const color = index === 0 ? 'rgba(33, 150, 243, 0.3)' : 'rgba(76, 175, 80, 0.3)';
        const borderColor = index === 0 ? '#2196F3' : '#4CAF50';
        const label = index === 0 ? 'Document ID' : 'Sheet';
        
        ocrConfigState.ctx.fillStyle = color;
        ocrConfigState.ctx.fillRect(region.x, region.y, region.width, region.height);
        ocrConfigState.ctx.strokeStyle = borderColor;
        ocrConfigState.ctx.lineWidth = 2;
        ocrConfigState.ctx.strokeRect(region.x, region.y, region.width, region.height);
        
        // Draw label
        ocrConfigState.ctx.fillStyle = borderColor;
        ocrConfigState.ctx.font = 'bold 14px Arial';
        ocrConfigState.ctx.fillText(label, region.x + 5, region.y + 20);
    });
}

function updateOCRStatus() {
    const statusText = document.getElementById('ocrStatusText');
    const statusDiv = document.querySelector('.ocr-status');
    
    if (ocrConfigState.regions.length === 0) {
        statusText.textContent = 'Marker første område (Document ID-Code)';
        statusDiv.classList.remove('completed');
    } else if (ocrConfigState.regions.length === 1) {
        statusText.textContent = 'Marker andre område (Sheet nummer)';
        statusDiv.classList.remove('completed');
    } else {
        statusText.textContent = 'Begge områder markert! Klikk "Lagre og fortsett"';
        statusDiv.classList.add('completed');
    }
}

function resetOCRRegions() {
    ocrConfigState.regions = [];
    document.getElementById('ocrSaveBtn').disabled = true;
    redrawCanvas();
    updateOCRStatus();
}

async function skipOCRConfig() {
    // Upload PDF without OCR configuration
    const ocrModal = document.getElementById('ocrConfigModal');
    closeModal(ocrModal);
    
    // Continue with normal PDF upload
    await uploadPDFWithoutOCR(ocrConfigState.pdfFile);
}

async function saveOCRConfig() {
    if (ocrConfigState.regions.length !== 2) {
        alert('Vennligst marker begge områdene');
        return;
    }
    
    const ocrModal = document.getElementById('ocrConfigModal');
    
    // Save OCR regions to package
    try {
        await fetch(`/api/packages/${currentPackageId}/ocr-config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ regions: ocrConfigState.regions })
        });
        
        closeModal(ocrModal);
        
        // Now upload the PDF
        await uploadPDFWithOCR(ocrConfigState.pdfFile);
        
    } catch (err) {
        alert('Feil ved lagring av OCR-konfigurasjon: ' + err.message);
    }
}

async function uploadPDFWithoutOCR(file) {
    const fileName = file.name.replace('.pdf', '');
    const formData = new FormData();
    formData.append('name', fileName);
    formData.append('lineNumber', 1);
    formData.append('pdf', file);
    formData.append('skipOCR', 'true');
    
    try {
        const response = await fetch(`/api/packages/${currentPackageId}/lines`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        loadPackageDetails(currentPackageId);
        
        if (result.multiple) {
            alert(`PDF-en ble delt opp i ${result.count} separate rørseksjoner (én per side).`);
        }
    } catch (err) {
        alert('Feil ved opplasting av PDF: ' + err.message);
    }
}

async function uploadPDFWithOCR(file) {
    const fileName = file.name.replace('.pdf', '');
    const formData = new FormData();
    formData.append('name', fileName);
    formData.append('lineNumber', 1);
    formData.append('pdf', file);
    
    try {
        const response = await fetch(`/api/packages/${currentPackageId}/lines`, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        loadPackageDetails(currentPackageId);
        
        if (result.multiple) {
            alert(`PDF-en ble delt opp i ${result.count} separate rørseksjoner med OCR-navngiving.`);
        }
    } catch (err) {
        alert('Feil ved opplasting av PDF: ' + err.message);
    }
}
