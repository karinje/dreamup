/**
 * Simple Express server for viewing QA reports
 * Run: node viewer/server.js
 */

import express from 'express';
import { readdir, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const OUTPUT_DIR = join(__dirname, '..', 'output');

// Middleware
app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API: Delete report (MUST come before static file serving and other routes)
app.delete('/api/reports/*', async (req, res) => {
  console.log(`🔥 DELETE route hit!`);
  console.log(`   Full URL: ${req.originalUrl}`);
  console.log(`   Path: ${req.path}`);
  console.log(`   Params[0]: ${req.params[0]}`);
  
  try {
    // Extract ID from path (everything after /api/reports/)
    const reportId = req.params[0];
    const reportDir = join(OUTPUT_DIR, reportId);
    
    console.log(`🗑️  Attempting to delete: ${reportDir}`);
    
    // Check if directory exists
    const { access } = await import('fs/promises');
    try {
      await access(reportDir);
      console.log(`✓ Directory exists`);
    } catch (err) {
      console.log(`✗ Directory not found: ${err.message}`);
      return res.status(404).json({ error: 'Report not found' });
    }
    
    // Check if this is a batch report - if so, delete all individual reports first
    const batchReportPath = join(reportDir, 'batch-report.json');
    try {
      const batchData = await readFile(batchReportPath, 'utf-8');
      const batchReport = JSON.parse(batchData);
      
      // Delete all individual reports referenced in the batch
      if (batchReport.results && Array.isArray(batchReport.results)) {
        for (const result of batchReport.results) {
          if (result.reportId) {
            const individualReportDir = join(OUTPUT_DIR, result.reportId);
            try {
              await access(individualReportDir);
              await rm(individualReportDir, { recursive: true, force: true });
              console.log(`✅ Deleted individual report: ${result.reportId}`);
            } catch (err) {
              console.log(`⚠️  Individual report ${result.reportId} not found or already deleted`);
            }
          }
        }
      }
    } catch {
      // Not a batch report, continue with normal deletion
    }
    
    // Delete the batch report directory itself (or individual report directory)
    await rm(reportDir, { recursive: true, force: true });
    
    console.log(`✅ Deleted report: ${reportId}`);
    res.json({ success: true, message: 'Report deleted successfully' });
  } catch (error) {
    console.error(`❌ Failed to delete report:`, error.message);
    console.error(error.stack);
    res.status(500).json({ error: 'Failed to delete report', details: error.message });
  }
});

// API: Get all reports (including batch reports)
app.get('/api/reports', async (req, res) => {
  try {
    const dirs = await readdir(OUTPUT_DIR);
    const reports = [];
    const batchReports = [];

    for (const dir of dirs) {
      if (dir === '.gitkeep') continue;

      // Check if this is a batch report directory
      const batchReportPath = join(OUTPUT_DIR, dir, 'batch-report.json');
      try {
        const batchData = await readFile(batchReportPath, 'utf-8');
        const batchReport = JSON.parse(batchData);
        batchReports.push({
          id: dir,
          type: 'batch',
          ...batchReport,
        });
        continue; // Skip individual report check for batch directories
      } catch {
        // Not a batch report, check for individual report
      }

      // Check for individual report
      const reportPath = join(OUTPUT_DIR, dir, 'qa-report.json');
      try {
        const data = await readFile(reportPath, 'utf-8');
        const report = JSON.parse(data);
        reports.push({
          id: dir,
          type: 'individual',
          ...report,
        });
      } catch (err) {
        console.error(`Failed to read report for ${dir}:`, err.message);
      }
    }

    // Sort by timestamp (newest first)
    reports.sort((a, b) => 
      new Date(b.metadata.timestamp) - new Date(a.metadata.timestamp)
    );
    batchReports.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );

    res.json({
      individual: reports,
      batch: batchReports,
      all: [...batchReports, ...reports].sort((a, b) => {
        const aTime = a.type === 'batch' ? new Date(a.timestamp) : new Date(a.metadata.timestamp);
        const bTime = b.type === 'batch' ? new Date(b.timestamp) : new Date(b.metadata.timestamp);
        return bTime - aTime;
      }),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Get batch report with all individual runs
app.get('/api/batch/:id', async (req, res) => {
  try {
    const batchReportPath = join(OUTPUT_DIR, req.params.id, 'batch-report.json');
    const batchData = await readFile(batchReportPath, 'utf-8');
    const batchReport = JSON.parse(batchData);
    
    // Load all individual reports referenced in the batch
    const individualReports = [];
    for (const result of batchReport.results) {
      if (result.reportId) {
        try {
          const reportPath = join(OUTPUT_DIR, result.reportId, 'qa-report.json');
          const reportData = await readFile(reportPath, 'utf-8');
          const report = JSON.parse(reportData);
          individualReports.push({
            id: result.reportId,
            ...report,
            label: result.label,
            gameName: result.gameName,
          });
        } catch (err) {
          console.error(`Failed to load individual report ${result.reportId}:`, err.message);
        }
      }
    }
    
    res.json({
      batch: {
        id: req.params.id,
        ...batchReport,
      },
      individualReports,
    });
  } catch (error) {
    res.status(404).json({ error: 'Batch report not found' });
  }
});

// API: Get single report
app.get('/api/reports/:id', async (req, res) => {
  try {
    const reportPath = join(OUTPUT_DIR, req.params.id, 'qa-report.json');
    const data = await readFile(reportPath, 'utf-8');
    const report = JSON.parse(data);
    
    res.json({
      id: req.params.id,
      ...report,
    });
  } catch (error) {
    res.status(404).json({ error: 'Report not found' });
  }
});

// API: Get logs
app.get('/api/reports/:id/logs', async (req, res) => {
  try {
    const logsPath = join(OUTPUT_DIR, req.params.id, 'logs', 'console-logs.json');
    const data = await readFile(logsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.status(404).json({ error: 'Logs not found' });
  }
});

// Serve static files (MUST come after API routes)
app.use('/output', express.static(OUTPUT_DIR));
app.use(express.static(join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`\n🎮 DreamUp QA Viewer running at http://localhost:${PORT}`);
  console.log(`📊 View reports at http://localhost:${PORT}\n`);
});

