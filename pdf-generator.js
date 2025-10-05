const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');

function formatNorwegianDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

async function generatePDFReport(packageData, outputPath) {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4',
                margins: { top: 70, bottom: 50, left: 50, right: 50 }
            });
            const stream = fs.createWriteStream(outputPath);
            
            doc.pipe(stream);

            // Logo paths
            const logoPath = path.join(__dirname, 'public', 'assets', 'logo.png');
            const logoPathJpg = path.join(__dirname, 'public', 'assets', 'logo.jpg');
            let hasLogo = false;
            let activeLogoPath = '';
            
            if (fs.existsSync(logoPath)) {
                hasLogo = true;
                activeLogoPath = logoPath;
            } else if (fs.existsSync(logoPathJpg)) {
                hasLogo = true;
                activeLogoPath = logoPathJpg;
            }

            // Function to add header with logo on each page
            function addHeader() {
                if (hasLogo) {
                    doc.image(activeLogoPath, 50, 30, { width: 80 });
                }
            }

            // Add logo on first page
            addHeader();
            doc.moveDown(3);

            // Listen for page additions to add header
            doc.on('pageAdded', () => {
                addHeader();
                doc.y = 100; // Set starting position below logo
            });

            // Header with background
            doc.rect(50, doc.y, doc.page.width - 100, 80)
               .fill('#f8f9fa');
            
            doc.fontSize(26)
               .fillColor('#ff6b35')
               .font('Helvetica-Bold')
               .text('Kamerainspeksjonsrapport', 50, doc.y + 15, { align: 'center', width: doc.page.width - 100 });
            
            doc.moveDown(0.8);
            
            // Project info
            if (packageData.project) {
                doc.fontSize(14)
                   .fillColor('#ff8c42')
                   .font('Helvetica-Bold')
                   .text(`Prosjekt: ${packageData.project.project_number}`, { align: 'center' });
                doc.fontSize(12)
                   .fillColor('#495057')
                   .font('Helvetica')
                   .text(`Kunde: ${packageData.project.customer_name}`, { align: 'center' });
                doc.moveDown(0.5);
            }
            
            doc.fontSize(18)
               .fillColor('#ff8c42')
               .font('Helvetica-Bold')
               .text(packageData.name, { align: 'center' });
            
            // Add footer to the first page
            let footerText = `Generert: ${formatNorwegianDate(new Date().toISOString())}`;
            if (packageData.project) {
                footerText = `${packageData.project.project_number} - ${packageData.project.customer_name} | ${footerText}`;
            }
            
            doc.fontSize(8)
               .fillColor('#999999')
               .text(
                   footerText,
                   50,
                   doc.page.height - 50,
                   { align: 'center', width: doc.page.width - 100 }
               );
            
            doc.moveDown(2);

            // Summary Section with styled box
            const summaryStartY = doc.y;
            doc.roundedRect(50, summaryStartY, doc.page.width - 100, 20, 3)
               .fill('#ff6b35');
            
            doc.fontSize(14)
               .fillColor('#ffffff')
               .font('Helvetica-Bold')
               .text('SAMMENDRAG', 50, summaryStartY + 5, { align: 'center', width: doc.page.width - 100 });
            
            doc.moveDown(0.8);
            
            // Summary content - calculate height dynamically
            const contentStartY = doc.y;
            const contentStartX = 60;
            
            doc.y = contentStartY + 10;
            doc.x = contentStartX;
            
            doc.fontSize(10)
               .fillColor('#495057')
               .font('Helvetica');
            
            if (packageData.project) {
                doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Prosjektnummer: ', { continued: true })
                   .font('Helvetica').fillColor('#212529').text(packageData.project.project_number);
                doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Kunde: ', { continued: true })
                   .font('Helvetica').fillColor('#212529').text(packageData.project.customer_name);
            }
            doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Pakkenavn: ', { continued: true })
               .font('Helvetica').fillColor('#212529').text(packageData.name);
            doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Dato: ', { continued: true })
               .font('Helvetica').fillColor('#212529').text(formatNorwegianDate(packageData.created_at));
            
            if (packageData.pipe_type) {
                doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Type rør: ', { continued: true })
                   .font('Helvetica').fillColor('#212529').text(packageData.pipe_type);
            }
            if (packageData.lining) {
                doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Lining: ', { continued: true })
                   .font('Helvetica').fillColor('#212529').text(packageData.lining);
            }
            
            doc.moveDown(0.3);
            const totalRemarks = packageData.pdfLines.reduce((sum, line) => sum + line.remarks.length, 0);
            doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Totalt antall rørseksjoner: ', { continued: true })
               .font('Helvetica').fillColor('#212529').text(packageData.pdfLines.length.toString());
            doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Totalt antall merknader: ', { continued: true })
               .font('Helvetica').fillColor('#212529').text(totalRemarks.toString());
            
            if (packageData.comment) {
                doc.moveDown(0.5);
                doc.font('Helvetica-Bold').fillColor('#ff6b35').text('Pakkekommentar: ', { continued: true })
                   .font('Helvetica').fillColor('#212529').text(packageData.comment);
            }

            // Draw the summary content box based on actual content height
            const contentEndY = doc.y + 10;
            const contentHeight = contentEndY - contentStartY;
            doc.roundedRect(50, contentStartY, doc.page.width - 100, contentHeight, 5)
               .lineWidth(1)
               .strokeColor('#dee2e6')
               .stroke();
            
            doc.y = contentEndY;
            doc.moveDown(1);

            // Summary Table with improved styling
            if (packageData.pdfLines.length > 0) {
                const tableStartY = doc.y;
                doc.roundedRect(50, tableStartY, doc.page.width - 100, 20, 3)
                   .fill('#ff6b35');
                
                doc.fontSize(14)
                   .fillColor('#ffffff')
                   .font('Helvetica-Bold')
                   .text('OVERSIKT OVER RØRSEKSJONER', 50, tableStartY + 5, { align: 'center', width: doc.page.width - 100 });
                
                doc.moveDown(1.5);
                doc.fontSize(10);

                // Table header
                const startY = doc.y;
                const colWidths = [70, 190, 100, 100];
                const startX = 50;
                const tableWidth = colWidths.reduce((a, b) => a + b, 0);

                // Header background
                doc.fillColor('#ff6b35')
                   .rect(startX, startY, tableWidth, 28)
                   .fill();

                doc.fillColor('#ffffff')
                   .font('Helvetica-Bold')
                   .text('Seksjon #', startX + 8, startY + 10, { width: colWidths[0] - 16, continued: false })
                   .text('Seksjonsnavn', startX + colWidths[0] + 8, startY + 10, { width: colWidths[1] - 16, continued: false })
                   .text('ISO-tegning', startX + colWidths[0] + colWidths[1] + 8, startY + 10, { width: colWidths[2] - 16, continued: false })
                   .text('Merknader', startX + colWidths[0] + colWidths[1] + colWidths[2] + 8, startY + 10, { width: colWidths[3] - 16 });

                doc.y = startY + 28;
                doc.font('Helvetica');

                // Table rows with borders
                packageData.pdfLines.forEach((line, index) => {
                    const rowY = doc.y;
                    const rowHeight = 26;
                    const bgColor = index % 2 === 0 ? '#ffffff' : '#f8f9fa';
                    
                    // Row background
                    doc.fillColor(bgColor)
                       .rect(startX, rowY, tableWidth, rowHeight)
                       .fill();
                    
                    // Row borders
                    doc.strokeColor('#dee2e6')
                       .lineWidth(0.5)
                       .rect(startX, rowY, tableWidth, rowHeight)
                       .stroke();

                    // Cell content with better padding
                    doc.fillColor('#212529')
                       .font('Helvetica-Bold')
                       .text(line.line_number, startX + 8, rowY + 8, { width: colWidths[0] - 16, continued: false })
                       .font('Helvetica')
                       .text(line.name, startX + colWidths[0] + 8, rowY + 8, { width: colWidths[1] - 16, continued: false });
                    
                    // ISO drawing indicator with color
                    const hasIso = line.pdf_path;
                    doc.fillColor(hasIso ? '#28a745' : '#dc3545')
                       .font('Helvetica-Bold')
                       .text(hasIso ? '✓ Ja' : '✗ Nei', startX + colWidths[0] + colWidths[1] + 8, rowY + 8, { width: colWidths[2] - 16, continued: false });
                    
                    // Remarks count with badge
                    const remarkCount = line.remarks.length;
                    if (remarkCount > 0) {
                        doc.fillColor('#ffc107')
                           .roundedRect(startX + colWidths[0] + colWidths[1] + colWidths[2] + 8, rowY + 7, 28, 14, 3)
                           .fill();
                        doc.fillColor('#000000')
                           .font('Helvetica-Bold')
                           .text(remarkCount.toString(), startX + colWidths[0] + colWidths[1] + colWidths[2] + 8, rowY + 8, { width: 28, align: 'center' });
                    } else {
                        doc.fillColor('#6c757d')
                           .font('Helvetica')
                           .text('0', startX + colWidths[0] + colWidths[1] + colWidths[2] + 8, rowY + 8, { width: colWidths[3] - 16 });
                    }

                    doc.y = rowY + rowHeight;
                });
                
                // Table bottom border
                doc.strokeColor('#ff6b35')
                   .lineWidth(2)
                   .moveTo(startX, doc.y)
                   .lineTo(startX + tableWidth, doc.y)
                   .stroke();
            }

            // Detailed Sections - only show if there are remarks
            const hasRemarks = packageData.pdfLines.some(line => line.remarks.length > 0);
            
            if (hasRemarks) {
                // Check if we need a new page BEFORE trying to add content
                if (doc.y > 600) {
                    doc.addPage();
                }
                
                doc.moveDown(2);
                const remarksHeaderY = doc.y;
                doc.roundedRect(50, remarksHeaderY, doc.page.width - 100, 20, 3)
                   .fill('#ff6b35');
                
                doc.fontSize(14)
                   .fillColor('#ffffff')
                   .font('Helvetica-Bold')
                   .text('DETALJERTE MERKNADER', 50, remarksHeaderY + 5, { align: 'center', width: doc.page.width - 100 });
                
                doc.moveDown(1.5);
            }

            packageData.pdfLines.forEach((line, lineIndex) => {
                // Only show section if it has remarks
                if (line.remarks.length > 0) {
                    // Check if we need a new page
                    if (doc.y > 650) {
                        doc.addPage();
                    }
                    
                    // Section header with styled box
                    const sectionHeaderY = doc.y;
                    doc.roundedRect(50, sectionHeaderY, doc.page.width - 100, 30, 5)
                       .fill('#e9ecef');
                    
                    doc.fontSize(13)
                       .fillColor('#ff6b35')
                       .font('Helvetica-Bold')
                       .text(`${line.name}`, 60, sectionHeaderY + 8, { width: doc.page.width - 140, continued: false });
                    
                    doc.fontSize(10)
                       .fillColor('#6c757d')
                       .font('Helvetica')
                       .text(`Seksjon ${line.line_number}`, 60, sectionHeaderY + 20, { width: doc.page.width - 140 });
                    
                    doc.y = sectionHeaderY + 35;
                }

                // Remarks
                if (line.remarks.length > 0) {
                    line.remarks.forEach((remark, remarkIndex) => {
                        // Check if we need a new page BEFORE adding the remark
                        if (doc.y > 400) {
                            doc.addPage();
                        }
                        
                        // Remark box - calculate height dynamically
                        const remarkBoxY = doc.y;
                        const remarkBoxStartY = remarkBoxY;
                        
                        // Remark number badge
                        doc.roundedRect(65, remarkBoxY + 10, 35, 18, 3)
                           .fill('#ffc107');
                        doc.fillColor('#000000')
                           .fontSize(11)
                           .font('Helvetica-Bold')
                           .text(`#${remarkIndex + 1}`, 65, remarkBoxY + 13, { width: 35, align: 'center' });
                        
                        doc.y = remarkBoxY + 35;
                        
                        const imagePath = path.join(__dirname, remark.image_path.replace('/uploads/', 'uploads/'));
                        
                        if (fs.existsSync(imagePath)) {
                            try {
                                // Add image with border
                                const imageX = 65;
                                const imageY = doc.y;
                                const imageWidth = doc.page.width - 130;
                                const imageHeight = 220;
                                
                                // Image border
                                doc.roundedRect(imageX, imageY, imageWidth, imageHeight, 3)
                                   .lineWidth(1)
                                   .strokeColor('#ced4da')
                                   .stroke();
                                
                                doc.image(imagePath, imageX + 5, imageY + 5, {
                                    fit: [imageWidth - 10, imageHeight - 10],
                                    align: 'center',
                                    valign: 'center'
                                });
                                
                                doc.y = imageY + imageHeight + 10;
                            } catch (err) {
                                doc.fontSize(10)
                                   .fillColor('#dc3545')
                                   .font('Helvetica')
                                   .text(`[Kunne ikke laste bilde]`, 65, doc.y);
                                doc.moveDown(0.5);
                            }
                        }

                        // Comment section - dynamic height
                        if (remark.comment) {
                            const commentBoxStartY = doc.y;
                            const commentBoxX = 65;
                            const commentBoxWidth = doc.page.width - 130;
                            
                            // Measure comment text height
                            const commentTextY = commentBoxStartY + 20;
                            doc.y = commentTextY;
                            
                            doc.fontSize(9)
                               .fillColor('#212529')
                               .font('Helvetica')
                               .text(remark.comment, commentBoxX + 10, commentTextY, { 
                                   width: commentBoxWidth - 20
                               });
                            
                            const commentEndY = doc.y + 10;
                            const commentBoxHeight = commentEndY - commentBoxStartY;
                            
                            // Draw comment box with dynamic height
                            doc.roundedRect(commentBoxX, commentBoxStartY, commentBoxWidth, commentBoxHeight, 3)
                               .fill('#f8f9fa');
                            
                            // Redraw label and text on top of background
                            doc.fontSize(9)
                               .fillColor('#6c757d')
                               .font('Helvetica-Bold')
                               .text('KOMMENTAR:', commentBoxX + 10, commentBoxStartY + 8, { width: commentBoxWidth - 20 });
                            
                            doc.fontSize(9)
                               .fillColor('#212529')
                               .font('Helvetica')
                               .text(remark.comment, commentBoxX + 10, commentBoxStartY + 20, { 
                                   width: commentBoxWidth - 20
                               });
                            
                            doc.y = commentEndY;
                        }

                        // Calculate total remark box height and draw border
                        const remarkBoxEndY = doc.y + 10;
                        const remarkBoxHeight = remarkBoxEndY - remarkBoxStartY;
                        
                        doc.roundedRect(55, remarkBoxStartY, doc.page.width - 110, remarkBoxHeight, 5)
                           .lineWidth(1)
                           .strokeColor('#dee2e6')
                           .stroke();
                        
                        doc.y = remarkBoxEndY + 5;
                    });

                    // Add page break between sections with remarks if needed
                    if (doc.y > 600) {
                        doc.addPage();
                    }
                }
            });

            doc.end();

            stream.on('finish', async () => {
                try {
                    // Now merge PDF files if any exist
                    const hasPdfs = packageData.pdfLines.some(line => line.pdf_path);
                    
                    if (hasPdfs) {
                        await mergePDFsWithReport(outputPath, packageData);
                    }
                    
                    resolve(outputPath);
                } catch (err) {
                    console.error('Error merging PDFs:', err);
                    resolve(outputPath); // Still return the report even if PDF merge fails
                }
            });

            stream.on('error', (err) => {
                reject(err);
            });

        } catch (err) {
            reject(err);
        }
    });
}

async function mergePDFsWithReport(reportPath, packageData) {
    try {
        // Load the generated report
        const reportBytes = fs.readFileSync(reportPath);
        const mergedPdf = await PDFLibDocument.load(reportBytes);
        
        // Process each line that has a PDF
        for (const line of packageData.pdfLines) {
            if (line.pdf_path) {
                const pdfPath = path.join(__dirname, line.pdf_path.replace('/uploads/', 'uploads/'));
                
                if (fs.existsSync(pdfPath)) {
                    try {
                        const isoPdfBytes = fs.readFileSync(pdfPath);
                        const isoPdf = await PDFLibDocument.load(isoPdfBytes);
                        
                        // Copy all pages from the ISO drawing
                        const copiedPages = await mergedPdf.copyPages(isoPdf, isoPdf.getPageIndices());
                        
                        // Add each page to the merged document
                        copiedPages.forEach(page => {
                            mergedPdf.addPage(page);
                        });
                    } catch (err) {
                        console.error(`Error loading PDF ${pdfPath}:`, err);
                    }
                }
            }
        }
        
        // Save the merged PDF
        const mergedPdfBytes = await mergedPdf.save();
        fs.writeFileSync(reportPath, mergedPdfBytes);
        
    } catch (err) {
        console.error('Error in mergePDFsWithReport:', err);
        throw err;
    }
}

// Generate PDF report for entire project (all packages)
async function generateProjectReport(project, packagesData, outputPath) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    // Title Page
    doc.fontSize(24).text('Kamerainspeksjonsrapport', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text(project.project_number, { align: 'center' });
    doc.fontSize(14).text(project.customer_name, { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(12).text(`Dato: ${formatNorwegianDate(new Date().toISOString())}`, { align: 'center' });
    doc.moveDown(2);
    
    // Summary
    const totalPackages = packagesData.length;
    const totalLines = packagesData.reduce((sum, pkg) => sum + pkg.pdfLines.length, 0);
    const totalRemarks = packagesData.reduce((sum, pkg) => 
        sum + pkg.pdfLines.reduce((s, line) => s + line.remarks.length, 0), 0);
    
    doc.fontSize(12).text('Prosjektoversikt:', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(10);
    doc.text(`Totalt antall pakker: ${totalPackages}`);
    doc.text(`Totalt antall rørseksjoner: ${totalLines}`);
    doc.text(`Totalt antall merknader: ${totalRemarks}`);
    
    // Generate report for each package
    for (let i = 0; i < packagesData.length; i++) {
        const pkg = packagesData[i];
        
        // New page for each package
        doc.addPage();
        
        // Package header
        doc.fontSize(18).text(`Pakke: ${pkg.name}`, { underline: true });
        doc.moveDown();
        
        // Package details
        doc.fontSize(10);
        if (pkg.pipe_type) {
            doc.text(`Type rør: ${pkg.pipe_type}`);
        }
        if (pkg.lining) {
            doc.text(`Lining: ${pkg.lining}`);
        }
        if (pkg.comment) {
            doc.moveDown(0.5);
            doc.text(`Kommentar: ${pkg.comment}`);
        }
        doc.moveDown();
        
        // Package summary
        doc.text(`Antall rørseksjoner: ${pkg.pdfLines.length}`);
        doc.text(`Antall merknader: ${pkg.pdfLines.reduce((sum, line) => sum + line.remarks.length, 0)}`);
        doc.moveDown();
        
        // Process each line in the package
        for (const line of pkg.pdfLines) {
            // Check if we need a new page
            if (doc.y > 650) {
                doc.addPage();
            }
            
            // Line header
            doc.fontSize(12).text(`Seksjon ${line.line_number}: ${line.name}`, { underline: true });
            doc.moveDown(0.5);
            
            // Embed PDF if available
            if (line.pdf_path) {
                try {
                    const pdfPath = path.join(__dirname, line.pdf_path);
                    if (fs.existsSync(pdfPath)) {
                        const pdfBytes = fs.readFileSync(pdfPath);
                        const embeddedPdf = await PDFDocument.load(pdfBytes);
                        const [embeddedPage] = await doc.embedPdf(embeddedPdf, [0]);
                        
                        const scale = Math.min(
                            (doc.page.width - 100) / embeddedPage.width,
                            300 / embeddedPage.height
                        );
                        
                        if (doc.y + (embeddedPage.height * scale) > doc.page.height - 50) {
                            doc.addPage();
                        }
                        
                        doc.image(embeddedPage, {
                            fit: [doc.page.width - 100, 300],
                            align: 'center'
                        });
                        doc.moveDown();
                    }
                } catch (err) {
                    console.error(`Error embedding PDF for line ${line.id}:`, err);
                    doc.fontSize(10).text('(ISO-tegning kunne ikke lastes)', { italics: true });
                    doc.moveDown();
                }
            }
            
            // Remarks
            if (line.remarks.length > 0) {
                doc.fontSize(11).text(`Merknader (${line.remarks.length}):`, { underline: true });
                doc.moveDown(0.5);
                
                for (const remark of line.remarks) {
                    // Check if we need a new page
                    if (doc.y > 600) {
                        doc.addPage();
                    }
                    
                    // Add remark image
                    try {
                        const imagePath = path.join(__dirname, remark.image_path);
                        if (fs.existsSync(imagePath)) {
                            const imageWidth = 200;
                            if (doc.y + 200 > doc.page.height - 50) {
                                doc.addPage();
                            }
                            doc.image(imagePath, {
                                fit: [imageWidth, 200],
                                align: 'left'
                            });
                            doc.moveDown(0.5);
                        }
                    } catch (err) {
                        console.error(`Error adding remark image ${remark.id}:`, err);
                    }
                    
                    // Add remark comment
                    if (remark.comment) {
                        doc.fontSize(10).text(`Kommentar: ${remark.comment}`, {
                            width: doc.page.width - 100
                        });
                    }
                    doc.moveDown();
                }
            } else {
                doc.fontSize(10).text('Ingen merknader', { italics: true });
            }
            
            doc.moveDown();
        }
    }
    
    doc.end();

    return new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

module.exports = { generatePDFReport, generateProjectReport };
