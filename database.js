const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'kamera_reports.db');
const db = new sqlite3.Database(dbPath);

// Initialize database schema
db.serialize(() => {
  // Projects table
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Test packages table
  db.run(`
    CREATE TABLE IF NOT EXISTS test_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      comment TEXT,
      pipe_type TEXT,
      lining TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `);

  // Add new columns to existing table if they don't exist
  db.run(`ALTER TABLE test_packages ADD COLUMN pipe_type TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding pipe_type column:', err);
    }
  });
  
  db.run(`ALTER TABLE test_packages ADD COLUMN lining TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding lining column:', err);
    }
  });

  // PDFs/Lines in test package
  db.run(`
    CREATE TABLE IF NOT EXISTS pdf_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_package_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      pdf_path TEXT,
      line_number INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (test_package_id) REFERENCES test_packages(id) ON DELETE CASCADE
    )
  `);

  // Remarks (images with comments)
  db.run(`
    CREATE TABLE IF NOT EXISTS remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pdf_line_id INTEGER NOT NULL,
      image_path TEXT NOT NULL,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (pdf_line_id) REFERENCES pdf_lines(id) ON DELETE CASCADE
    )
  `);
});

// Database helper functions
const dbHelpers = {
  // Projects
  getAllProjects: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM projects ORDER BY created_at DESC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getProjectById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM projects WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  createProject: (projectNumber, customerName) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO projects (project_number, customer_name) VALUES (?, ?)', [projectNumber, customerName], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, projectNumber, customerName });
      });
    });
  },

  updateProject: (id, projectNumber, customerName) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE projects SET project_number = ?, customer_name = ? WHERE id = ?', 
        [projectNumber, customerName, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  deleteProject: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM projects WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // Test Packages
  getAllTestPackages: () => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM test_packages ORDER BY created_at DESC', [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  getTestPackageById: (id) => {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM test_packages WHERE id = ?', [id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },

  getTestPackagesByProject: (projectId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM test_packages WHERE project_id = ? ORDER BY name ASC', [projectId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  createTestPackage: (projectId, name, comment, pipeType, lining) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO test_packages (project_id, name, comment, pipe_type, lining) VALUES (?, ?, ?, ?, ?)', 
        [projectId, name, comment, pipeType, lining], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, projectId, name, comment, pipeType, lining });
      });
    });
  },

  updateTestPackageComment: (id, comment) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE test_packages SET comment = ? WHERE id = ?', [comment, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  updateTestPackage: (id, name, comment, pipeType, lining) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE test_packages SET name = ?, comment = ?, pipe_type = ?, lining = ? WHERE id = ?', 
        [name, comment, pipeType, lining, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  deleteTestPackage: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM test_packages WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // PDF Lines
  getPdfLinesByPackage: (packageId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM pdf_lines WHERE test_package_id = ? ORDER BY line_number', [packageId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  createPdfLine: (testPackageId, name, pdfPath, lineNumber) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO pdf_lines (test_package_id, name, pdf_path, line_number) VALUES (?, ?, ?, ?)', 
        [testPackageId, name, pdfPath, lineNumber], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, testPackageId, name, pdfPath, lineNumber });
      });
    });
  },

  updatePdfLine: (id, name, lineNumber) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE pdf_lines SET name = ?, line_number = ? WHERE id = ?', 
        [name, lineNumber, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  deletePdfLine: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM pdf_lines WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // Remarks
  getRemarksByPdfLine: (pdfLineId) => {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM remarks WHERE pdf_line_id = ? ORDER BY created_at', [pdfLineId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  },

  createRemark: (pdfLineId, imagePath, comment) => {
    return new Promise((resolve, reject) => {
      db.run('INSERT INTO remarks (pdf_line_id, image_path, comment) VALUES (?, ?, ?)', 
        [pdfLineId, imagePath, comment], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, pdfLineId, imagePath, comment });
      });
    });
  },

  updateRemarkComment: (id, comment) => {
    return new Promise((resolve, reject) => {
      db.run('UPDATE remarks SET comment = ? WHERE id = ?', [comment, id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  deleteRemark: (id) => {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM remarks WHERE id = ?', [id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });
  },

  // Get full package with all related data (including project info)
  getFullPackage: async (packageId) => {
    try {
      const testPackage = await dbHelpers.getTestPackageById(packageId);
      if (!testPackage) return null;

      // Get project information
      const project = await dbHelpers.getProjectById(testPackage.project_id);
      testPackage.project = project;

      const pdfLines = await dbHelpers.getPdfLinesByPackage(packageId);
      
      for (let line of pdfLines) {
        line.remarks = await dbHelpers.getRemarksByPdfLine(line.id);
      }

      testPackage.pdfLines = pdfLines;
      return testPackage;
    } catch (err) {
      throw err;
    }
  }
};

module.exports = { db, dbHelpers };
