const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { dbHelpers } = require('./database');
const { generatePDFReport, generateProjectReport } = require('./pdf-generator');

const app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'kamera-report-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files with authentication check for main app
app.use((req, res, next) => {
  // Allow access to login page and its assets without authentication
  if (req.path === '/login.html' || req.path.startsWith('/assets/')) {
    return express.static('public')(req, res, next);
  }
  
  // For other static files, check authentication
  if (!req.session.userId && req.path !== '/api/auth/login') {
    return res.redirect('/login.html');
  }
  
  express.static('public')(req, res, next);
});

app.use('/uploads', express.static('uploads'));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
const pdfsDir = path.join(uploadsDir, 'pdfs');
const remarksDir = path.join(uploadsDir, 'remarks');

[uploadsDir, pdfsDir, remarksDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, pdfsDir);
    } else {
      cb(null, remarksDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Ikke autorisert. Vennligst logg inn.' });
  }
  next();
};

// Authentication Routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Brukernavn og passord er påkrevd' });
    }

    const user = await dbHelpers.getUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({ error: 'Ugyldig brukernavn eller passord' });
    }

    if (!user.is_active) {
      return res.status(401).json({ error: 'Kontoen er deaktivert' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Ugyldig brukernavn eller passord' });
    }

    // Update last login
    await dbHelpers.updateUserLastLogin(user.id);

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    
    if (rememberMe) {
      req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
    }

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        username: user.username,
        fullName: user.full_name
      } 
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'En feil oppstod ved innlogging' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Kunne ikke logge ut' });
    }
    res.json({ success: true });
  });
});

app.get('/api/auth/check', (req, res) => {
  if (req.session.userId) {
    res.json({ authenticated: true, userId: req.session.userId, username: req.session.username });
  } else {
    res.json({ authenticated: false });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Både nåværende og nytt passord er påkrevd' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Nytt passord må være minst 6 tegn' });
    }

    // Get current user
    const user = await dbHelpers.getUserById(req.session.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Bruker ikke funnet' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Nåværende passord er feil' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await new Promise((resolve, reject) => {
      const { db } = require('./database');
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [newPasswordHash, user.id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    res.json({ success: true, message: 'Passordet ble endret' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'En feil oppstod ved endring av passord' });
  }
});

// API Routes (Protected)

// Projects
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const projects = await dbHelpers.getAllProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const project = await dbHelpers.getProjectById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const { projectNumber, customerName } = req.body;
    const newProject = await dbHelpers.createProject(projectNumber, customerName);
    res.json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { projectNumber, customerName } = req.body;
    await dbHelpers.updateProject(req.params.id, projectNumber, customerName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    await dbHelpers.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Packages
app.get('/api/projects/:projectId/packages', requireAuth, async (req, res) => {
  try {
    const packages = await dbHelpers.getTestPackagesByProject(req.params.projectId);
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages', requireAuth, async (req, res) => {
  try {
    const packages = await dbHelpers.getAllTestPackages();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages/:id', requireAuth, async (req, res) => {
  try {
    const packageData = await dbHelpers.getFullPackage(req.params.id);
    if (!packageData) {
      return res.status(404).json({ error: 'Package not found' });
    }
    res.json(packageData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/projects/:projectId/packages', requireAuth, async (req, res) => {
  try {
    const { name, comment, pipeType, lining } = req.body;
    const newPackage = await dbHelpers.createTestPackage(
      req.params.projectId, 
      name, 
      comment || '', 
      pipeType || '', 
      lining || ''
    );
    res.json(newPackage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/packages/:id/comment', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    await dbHelpers.updateTestPackageComment(req.params.id, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/packages/:id', requireAuth, async (req, res) => {
  try {
    const { name, comment, pipeType, lining } = req.body;
    await dbHelpers.updateTestPackage(req.params.id, name, comment || '', pipeType || '', lining || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/packages/:id', requireAuth, async (req, res) => {
  try {
    await dbHelpers.deleteTestPackage(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Lines
app.get('/api/packages/:packageId/lines', requireAuth, async (req, res) => {
  try {
    const lines = await dbHelpers.getPdfLinesByPackage(req.params.packageId);
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages/:packageId/lines', requireAuth, upload.single('pdf'), async (req, res) => {
  try {
    const { name, lineNumber } = req.body;
    
    if (!req.file) {
      // No PDF file, just create the line
      const newLine = await dbHelpers.createPdfLine(
        req.params.packageId,
        name,
        null,
        parseInt(lineNumber) || 0
      );
      return res.json(newLine);
    }
    
    // Check if PDF has multiple pages and split if needed
    const pdfPath = path.join(__dirname, 'uploads', 'pdfs', req.file.filename);
    const { PDFDocument: PDFLibDocument } = require('pdf-lib');
    
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFLibDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();
    
    if (pageCount === 1) {
      // Single page PDF
      const newLine = await dbHelpers.createPdfLine(
        req.params.packageId,
        name,
        `/uploads/pdfs/${req.file.filename}`,
        parseInt(lineNumber) || 0
      );
      res.json(newLine);
    } else {
      // Multiple pages, split into separate lines
      const createdLines = [];
      let currentLineNumber = parseInt(lineNumber) || 0;
      
      console.log(`Processing ${pageCount} pages...`);
      
      for (let i = 0; i < pageCount; i++) {
        // Create a new PDF with just this page
        const newPdf = await PDFLibDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        
        const newPdfBytes = await newPdf.save();
        const newFilename = `${Date.now()}-${Math.round(Math.random() * 1E9)}-page${i + 1}.pdf`;
        const newPdfPath = path.join(__dirname, 'uploads', 'pdfs', newFilename);
        
        fs.writeFileSync(newPdfPath, newPdfBytes);
        
        const lineName = pageCount > 1 ? `${name} - Side ${i + 1}` : name;
        
        console.log(`Creating line: ${lineName}`);
        
        const newLine = await dbHelpers.createPdfLine(
          req.params.packageId,
          lineName,
          `/uploads/pdfs/${newFilename}`,
          currentLineNumber + i
        );
        
        createdLines.push(newLine);
      }
      
      // Delete the original multi-page PDF
      fs.unlinkSync(pdfPath);
      
      res.json({ 
        multiple: true, 
        count: createdLines.length,
        lines: createdLines 
      });
    }
  } catch (err) {
    console.error('Error creating PDF line:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/lines/:id', requireAuth, async (req, res) => {
  try {
    console.log('DEBUG SERVER: PUT /api/lines/:id');
    console.log('DEBUG SERVER: Line ID:', req.params.id);
    console.log('DEBUG SERVER: Request body:', req.body);
    
    const { name, lineNumber } = req.body;
    const result = await dbHelpers.updatePdfLine(req.params.id, name, parseInt(lineNumber) || 0);
    
    console.log('DEBUG SERVER: Update result:', result);
    res.json({ success: true, result });
  } catch (err) {
    console.error('DEBUG SERVER: Error updating line:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lines/:id', requireAuth, async (req, res) => {
  try {
    await dbHelpers.deletePdfLine(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remarks
app.get('/api/lines/:lineId/remarks', requireAuth, async (req, res) => {
  try {
    const remarks = await dbHelpers.getRemarksByPdfLine(req.params.lineId);
    res.json(remarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lines/:lineId/remarks', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { comment } = req.body;
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }
    const imagePath = `/uploads/remarks/${req.file.filename}`;
    const newRemark = await dbHelpers.createRemark(
      req.params.lineId,
      imagePath,
      comment || ''
    );
    res.json(newRemark);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/remarks/:id/comment', requireAuth, async (req, res) => {
  try {
    const { comment } = req.body;
    await dbHelpers.updateRemarkComment(req.params.id, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/remarks/:id', requireAuth, async (req, res) => {
  try {
    await dbHelpers.deleteRemark(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF Report for single package
app.get('/api/packages/:id/generate-report', requireAuth, async (req, res) => {
    try {
        const packageData = await dbHelpers.getFullPackage(req.params.id);
        if (!packageData) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const reportsDir = path.join(__dirname, 'uploads', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Format date as YYYY-MM-DD
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        const filename = `${packageData.name.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.pdf`;
        const outputPath = path.join(reportsDir, filename);

        await generatePDFReport(packageData, outputPath);

        res.download(outputPath, filename, (err) => {
            if (err) {
                console.error('Error sending file:', err);
            }
            // Clean up the file after download
            setTimeout(() => {
                if (fs.existsSync(outputPath)) {
                    fs.unlinkSync(outputPath);
                }
            }, 5000);
        });
    } catch (err) {
        console.error('Error generating report:', err);
        res.status(500).json({ error: err.message });
    }
});

// Export project with all data and files as ZIP
app.get('/api/projects/:id/export', requireAuth, async (req, res) => {
    try {
        const project = await dbHelpers.getProjectById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const packages = await dbHelpers.getTestPackagesByProject(req.params.id);
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            project: project,
            packages: []
        };

        // Get full data for each package
        for (const pkg of packages) {
            const fullPackage = await dbHelpers.getFullPackage(pkg.id);
            exportData.packages.push(fullPackage);
        }

        // Create ZIP file
        const tempDir = path.join(__dirname, 'uploads', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const zipFilename = `${project.project_number.replace(/[^a-z0-9]/gi, '_')}_export.zip`;
        const zipPath = path.join(tempDir, zipFilename);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            res.download(zipPath, zipFilename, (err) => {
                if (err) {
                    console.error('Error sending ZIP:', err);
                }
                // Clean up
                setTimeout(() => {
                    if (fs.existsSync(zipPath)) {
                        fs.unlinkSync(zipPath);
                    }
                }, 5000);
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // Add data.json
        archive.append(JSON.stringify(exportData, null, 2), { name: 'data.json' });

        // Add all PDF files
        for (const pkg of exportData.packages) {
            for (const line of pkg.pdfLines) {
                if (line.pdf_path) {
                    const pdfFullPath = path.join(__dirname, line.pdf_path);
                    if (fs.existsSync(pdfFullPath)) {
                        archive.file(pdfFullPath, { name: `files${line.pdf_path}` });
                    }
                }
            }
        }

        // Add all remark images
        for (const pkg of exportData.packages) {
            for (const line of pkg.pdfLines) {
                for (const remark of line.remarks) {
                    if (remark.image_path) {
                        const imgFullPath = path.join(__dirname, remark.image_path);
                        if (fs.existsSync(imgFullPath)) {
                            archive.file(imgFullPath, { name: `files${remark.image_path}` });
                        }
                    }
                }
            }
        }

        await archive.finalize();

    } catch (err) {
        console.error('Error exporting project:', err);
        res.status(500).json({ error: err.message });
    }
});

// Import project from ZIP (with multer for file upload)
const importUpload = multer({ dest: path.join(__dirname, 'uploads', 'temp') });
const AdmZip = require('adm-zip');

app.post('/api/projects/import', requireAuth, importUpload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const zipPath = req.file.path;
        const zip = new AdmZip(zipPath);
        const zipEntries = zip.getEntries();

        // Extract data.json
        const dataEntry = zipEntries.find(e => e.entryName === 'data.json');
        if (!dataEntry) {
            return res.status(400).json({ error: 'Invalid export file - missing data.json' });
        }

        const importData = JSON.parse(dataEntry.getData().toString('utf8'));
        
        if (!importData.project || !importData.packages) {
            return res.status(400).json({ error: 'Invalid import format' });
        }

        // Create new project
        const newProject = await dbHelpers.createProject(
            importData.project.project_number + ' (Importert)',
            importData.project.customer_name
        );

        // Create packages
        for (const pkg of importData.packages) {
            const newPackage = await dbHelpers.createTestPackage(
                newProject.id,
                pkg.name,
                pkg.comment || '',
                pkg.pipe_type || '',
                pkg.lining || ''
            );

            // Create lines
            for (const line of pkg.pdfLines) {
                let pdfPath = null;
                
                // Extract and save PDF if exists
                if (line.pdf_path) {
                    const pdfEntry = zipEntries.find(e => e.entryName === `files${line.pdf_path}`);
                    if (pdfEntry) {
                        const pdfFilename = path.basename(line.pdf_path);
                        const newPdfPath = path.join(pdfsDir, pdfFilename);
                        fs.writeFileSync(newPdfPath, pdfEntry.getData());
                        pdfPath = line.pdf_path;
                    }
                }
                
                const newLine = await dbHelpers.createPdfLine(
                    newPackage.id,
                    line.name,
                    pdfPath,
                    line.line_number
                );

                // Create remarks with images
                for (const remark of line.remarks) {
                    let imagePath = '';
                    
                    if (remark.image_path) {
                        const imgEntry = zipEntries.find(e => e.entryName === `files${remark.image_path}`);
                        if (imgEntry) {
                            const imgFilename = path.basename(remark.image_path);
                            const newImgPath = path.join(remarksDir, imgFilename);
                            fs.writeFileSync(newImgPath, imgEntry.getData());
                            imagePath = remark.image_path;
                        }
                    }
                    
                    await dbHelpers.createRemark(
                        newLine.id,
                        imagePath,
                        remark.comment || ''
                    );
                }
            }
        }

        // Clean up temp file
        fs.unlinkSync(zipPath);

        res.json({ 
            success: true, 
            projectId: newProject.id,
            message: 'Prosjekt importert med alle filer!'
        });
    } catch (err) {
        console.error('Error importing project:', err);
        // Clean up temp file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: err.message });
    }
});

// Export single package
app.get('/api/packages/:id/export', requireAuth, async (req, res) => {
    try {
        const packageData = await dbHelpers.getFullPackage(req.params.id);
        if (!packageData) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            package: packageData
        };

        const filename = `${packageData.name.replace(/[^a-z0-9]/gi, '_')}_export.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.json(exportData);
    } catch (err) {
        console.error('Error exporting package:', err);
        res.status(500).json({ error: err.message });
    }
});

// Import package to current project
app.post('/api/projects/:projectId/packages/import', requireAuth, async (req, res) => {
    try {
        const importData = req.body;
        
        if (!importData.package) {
            return res.status(400).json({ error: 'Invalid import format' });
        }

        const pkg = importData.package;
        
        // Create package
        const newPackage = await dbHelpers.createTestPackage(
            req.params.projectId,
            pkg.name + ' (Importert)',
            pkg.comment || '',
            pkg.pipe_type || '',
            pkg.lining || ''
        );

        // Create lines
        for (const line of pkg.pdfLines) {
            const newLine = await dbHelpers.createPdfLine(
                newPackage.id,
                line.name,
                null,
                line.line_number
            );

            // Create remarks
            for (const remark of line.remarks) {
                await dbHelpers.createRemark(
                    newLine.id,
                    '',
                    remark.comment || ''
                );
            }
        }

        res.json({ 
            success: true, 
            packageId: newPackage.id,
            message: 'Pakke importert uten filer (PDFs og bilder)'
        });
    } catch (err) {
        console.error('Error importing package:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generate PDF Report for all packages in a project (as ZIP)
app.get('/api/projects/:id/generate-report', requireAuth, async (req, res) => {
    try {
        const project = await dbHelpers.getProjectById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const packages = await dbHelpers.getTestPackagesByProject(req.params.id);
        if (packages.length === 0) {
            return res.status(400).json({ error: 'No packages found in project' });
        }

        const reportsDir = path.join(__dirname, 'uploads', 'reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        // Format date as YYYY-MM-DD
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Generate individual PDF for each package
        const pdfFiles = [];
        for (const pkg of packages) {
            const fullPackage = await dbHelpers.getFullPackage(pkg.id);
            const pdfFilename = `${fullPackage.name.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.pdf`;
            const pdfPath = path.join(reportsDir, pdfFilename);
            
            await generatePDFReport(fullPackage, pdfPath);
            pdfFiles.push({ path: pdfPath, name: pdfFilename });
        }

        // Create ZIP file
        const zipFilename = `${project.project_number.replace(/[^a-z0-9]/gi, '_')}_${dateStr}.zip`;
        const zipPath = path.join(reportsDir, zipFilename);

        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            // Send the ZIP file
            res.download(zipPath, zipFilename, (err) => {
                if (err) {
                    console.error('Error sending ZIP file:', err);
                }
                // Clean up files after download
                setTimeout(() => {
                    // Delete individual PDFs
                    pdfFiles.forEach(file => {
                        if (fs.existsSync(file.path)) {
                            fs.unlinkSync(file.path);
                        }
                    });
                    // Delete ZIP file
                    if (fs.existsSync(zipPath)) {
                        fs.unlinkSync(zipPath);
                    }
                }, 5000);
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);

        // Add each PDF to the archive
        for (const file of pdfFiles) {
            archive.file(file.path, { name: file.name });
        }

        await archive.finalize();

    } catch (err) {
        console.error('Error generating project report:', err);
        res.status(500).json({ error: err.message });
    }
});

// Serve main page
app.get('/', (req, res) => {
    if (!req.session.userId) {
        return res.redirect('/login.html');
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login.html', (req, res) => {
    // If already logged in, redirect to main app
    if (req.session.userId) {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Initialize default admin user if no users exist
async function initializeDefaultUser() {
  try {
    const { db } = require('./database');
    
    // Check if any users exist
    const userCount = await new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      });
    });

    if (userCount === 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Ingen brukere funnet - oppretter standard admin-bruker...');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const defaultUsername = 'admin';
      const defaultPassword = 'admin123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      await dbHelpers.createUser(
        defaultUsername,
        passwordHash,
        'Administrator',
        'admin@example.com'
      );
      
      console.log('✅ Standard admin-bruker opprettet!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`Brukernavn: ${defaultUsername}`);
      console.log(`Passord: ${defaultPassword}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚠️  VIKTIG: Endre passordet etter første innlogging!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }
  } catch (err) {
    console.error('Feil ved initialisering av standard bruker:', err.message);
  }
}

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await initializeDefaultUser();
});
