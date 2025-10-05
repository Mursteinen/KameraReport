# Kamera Inspection Reports

A Node.js web application for managing camera inspection reports with test packages, PDF lines, and image remarks.

## Features

- **Test Packages**: Create and manage test packages with comments
- **PDF Lines**: Add multiple PDF files or lines to each test package
- **Remarks**: Attach images with comments to specific lines
- **SQLite Database**: All data stored locally in SQLite
- **Modern Web Interface**: Responsive design with intuitive UI

## Data Structure

The application manages three levels of data:

1. **Test Packages** - Top level containers for inspection reports
   - Name
   - Comment (editable)
   - Created date

2. **PDF Lines** - Lines or PDFs within a test package
   - Name
   - Line number
   - Optional PDF file attachment
   - Multiple lines per package

3. **Remarks** - Image observations on specific lines
   - Image (required)
   - Comment (editable)
   - Multiple remarks per line

## Installation

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

### Production Deployment

For deploying to a live server, see **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete instructions on deploying to Render.com (free tier available).

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Usage

### Creating a Test Package
1. Click "New Package" on the home screen
2. Enter a package name and optional comment
3. Click "Create"

### Adding PDF Lines
1. Open a test package
2. Click "Add Line/PDF"
3. Enter line name and number
4. Optionally upload a PDF file
5. Click "Add Line"

### Adding Remarks
1. Navigate to a line within a package
2. Click "Add Remark"
3. Select an image file
4. Add an optional comment
5. Click "Add Remark"

### Managing Comments
- **Package Comments**: Edit in the package details view and click "Save Comment"
- **Remark Comments**: Click on any remark image to view/edit its comment

## File Structure

```
kamera-inspection-reports/
├── server.js              # Express server and API routes
├── database.js            # SQLite database setup and helpers
├── package.json           # Project dependencies
├── public/
│   ├── index.html        # Main HTML interface
│   ├── styles.css        # Application styles
│   └── app.js            # Frontend JavaScript
├── uploads/              # Uploaded files (auto-created)
│   ├── pdfs/            # PDF files
│   └── remarks/         # Remark images
└── kamera_reports.db    # SQLite database (auto-created)
```

## API Endpoints

### Test Packages
- `GET /api/packages` - Get all packages
- `GET /api/packages/:id` - Get package with all related data
- `POST /api/packages` - Create new package
- `PUT /api/packages/:id/comment` - Update package comment
- `DELETE /api/packages/:id` - Delete package

### PDF Lines
- `GET /api/packages/:packageId/lines` - Get lines for a package
- `POST /api/packages/:packageId/lines` - Add new line (with optional PDF)
- `DELETE /api/lines/:id` - Delete line

### Remarks
- `GET /api/lines/:lineId/remarks` - Get remarks for a line
- `POST /api/lines/:lineId/remarks` - Add new remark (with image)
- `PUT /api/remarks/:id/comment` - Update remark comment
- `DELETE /api/remarks/:id` - Delete remark

## Technologies

- **Backend**: Node.js, Express
- **Database**: SQLite3
- **File Upload**: Multer
- **Frontend**: Vanilla JavaScript, HTML5, CSS3

## License

ISC
