const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { dbHelpers } = require('./database');
const { generatePDFReport, generateProjectReport } = require('./pdf-generator');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
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

// API Routes

// Projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await dbHelpers.getAllProjects();
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
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

app.post('/api/projects', async (req, res) => {
  try {
    const { projectNumber, customerName } = req.body;
    const newProject = await dbHelpers.createProject(projectNumber, customerName);
    res.json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/projects/:id', async (req, res) => {
  try {
    const { projectNumber, customerName } = req.body;
    await dbHelpers.updateProject(req.params.id, projectNumber, customerName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await dbHelpers.deleteProject(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Test Packages
app.get('/api/projects/:projectId/packages', async (req, res) => {
  try {
    const packages = await dbHelpers.getTestPackagesByProject(req.params.projectId);
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages', async (req, res) => {
  try {
    const packages = await dbHelpers.getAllTestPackages();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/packages/:id', async (req, res) => {
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

app.post('/api/projects/:projectId/packages', async (req, res) => {
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

app.put('/api/packages/:id/comment', async (req, res) => {
  try {
    const { comment } = req.body;
    await dbHelpers.updateTestPackageComment(req.params.id, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/packages/:id', async (req, res) => {
  try {
    const { name, comment, pipeType, lining } = req.body;
    await dbHelpers.updateTestPackage(req.params.id, name, comment || '', pipeType || '', lining || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/packages/:id', async (req, res) => {
  try {
    await dbHelpers.deleteTestPackage(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF Lines
app.get('/api/packages/:packageId/lines', async (req, res) => {
  try {
    const lines = await dbHelpers.getPdfLinesByPackage(req.params.packageId);
    res.json(lines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/packages/:packageId/lines', upload.single('pdf'), async (req, res) => {
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

app.put('/api/lines/:id', async (req, res) => {
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

app.delete('/api/lines/:id', async (req, res) => {
  try {
    await dbHelpers.deletePdfLine(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remarks
app.get('/api/lines/:lineId/remarks', async (req, res) => {
  try {
    const remarks = await dbHelpers.getRemarksByPdfLine(req.params.lineId);
    res.json(remarks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lines/:lineId/remarks', upload.single('image'), async (req, res) => {
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

app.put('/api/remarks/:id/comment', async (req, res) => {
  try {
    const { comment } = req.body;
    await dbHelpers.updateRemarkComment(req.params.id, comment);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/remarks/:id', async (req, res) => {
  try {
    await dbHelpers.deleteRemark(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generate PDF Report for single package
app.get('/api/packages/:id/generate-report', async (req, res) => {
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

// Generate PDF Report for all packages in a project (as ZIP)
app.get('/api/projects/:id/generate-report', async (req, res) => {
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
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
