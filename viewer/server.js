/**
 * Simple Express server for viewing QA reports
 * Run: node viewer/server.js
 */

import express from 'express';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;
const OUTPUT_DIR = join(__dirname, '..', 'output');

// Serve static files
app.use('/output', express.static(OUTPUT_DIR));
app.use(express.static(join(__dirname, 'public')));

// API: Get all reports
app.get('/api/reports', async (req, res) => {
  try {
    const dirs = await readdir(OUTPUT_DIR);
    const reports = [];

    for (const dir of dirs) {
      if (dir === '.gitkeep') continue;

      const reportPath = join(OUTPUT_DIR, dir, 'qa-report.json');
      try {
        const data = await readFile(reportPath, 'utf-8');
        const report = JSON.parse(data);
        reports.push({
          id: dir,
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

    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: error.message });
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

app.listen(PORT, () => {
  console.log(`\n🎮 DreamUp QA Viewer running at http://localhost:${PORT}`);
  console.log(`📊 View reports at http://localhost:${PORT}\n`);
});

