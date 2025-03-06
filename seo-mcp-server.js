// seo-mcp-server.js - Main MCP server file
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const port = 8767;

app.use(cors());
app.use(express.json());

// MCP SSE endpoint
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial message
  res.write('data: Connected to SEO Inspector MCP\n\n');

  // Keep connection alive
  const interval = setInterval(() => {
    res.write(': ping\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

// Analyze HTML files in a directory
app.post('/analyze-codebase', async (req, res) => {
  const { directoryPath } = req.body;

  try {
    const htmlFiles = await findHtmlFiles(directoryPath);
    const results = await Promise.all(
      htmlFiles.map((file) => analyzeHtmlFile(file))
    );

    res.json({
      totalFiles: htmlFiles.length,
      results,
    });
  } catch (error) {
    console.error('Error analyzing codebase:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analyze a specific HTML string
app.post('/analyze-html', (req, res) => {
  const { html, url } = req.body;

  try {
    const analysis = analyzeHtml(html, url || 'example.com');
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing HTML:', error);
    res.status(500).json({ error: error.message });
  }
});

async function findHtmlFiles(directory) {
  const htmlFiles = [];

  async function traverse(dir) {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      if (file.isDirectory()) {
        await traverse(filePath);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        htmlFiles.push(filePath);
      }
    }
  }

  await traverse(directory);
  return htmlFiles;
}

async function analyzeHtmlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const analysis = analyzeHtml(content, path.basename(filePath));

  return {
    filePath,
    ...analysis,
  };
}

function analyzeHtml(html, pageIdentifier) {
  const $ = cheerio.load(html);
  const issues = [];
  const recommendations = [];

  // Basic SEO checks
  const title = $('title').text();
  const metaDescription = $('meta[name="description"]').attr('content');
  const h1Count = $('h1').length;

  // Check title
  if (!title) {
    issues.push({ severity: 'high', message: 'Missing page title' });
  } else if (title.length < 30 || title.length > 60) {
    issues.push({
      severity: 'medium',
      message: `Title length (${title.length} chars) outside recommended range (30-60)`,
    });
  }

  // Check meta description
  if (!metaDescription) {
    issues.push({ severity: 'high', message: 'Missing meta description' });
  } else if (metaDescription.length < 50 || metaDescription.length > 160) {
    issues.push({
      severity: 'medium',
      message: `Meta description length (${metaDescription.length} chars) outside recommended range (50-160)`,
    });
  }

  // Check headings
  if (h1Count === 0) {
    issues.push({ severity: 'high', message: 'No H1 heading found' });
  } else if (h1Count > 1) {
    issues.push({
      severity: 'medium',
      message: `Multiple H1 headings found (${h1Count})`,
    });
  }

  // Check images
  $('img').each((i, img) => {
    const alt = $(img).attr('alt');
    if (!alt && !$(img).attr('role')) {
      issues.push({
        severity: 'medium',
        message: `Image missing alt text: ${
          $(img).attr('src') || 'unknown image'
        }`,
      });
    }
  });

  // Schema validation
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, script) => {
    try {
      const schema = JSON.parse($(script).html());
      schemas.push(schema);

      // Basic schema validation
      if (!schema['@context'] || !schema['@type']) {
        issues.push({
          severity: 'high',
          message: 'Invalid schema: missing @context or @type',
        });
      }
    } catch (e) {
      issues.push({ severity: 'high', message: 'Invalid JSON-LD schema' });
    }
  });

  // Add recommendations
  if (schemas.length === 0) {
    recommendations.push(
      'Add structured data using JSON-LD for rich search results'
    );
  }

  return {
    pageIdentifier,
    title,
    metaDescription,
    headingStructure: {
      h1: h1Count,
      h2: $('h2').length,
      h3: $('h3').length,
    },
    schemaCount: schemas.length,
    issues,
    recommendations,
    schemas,
  };
}

app.listen(port, () => {
  console.log(`SEO Inspector MCP server running at http://localhost:${port}`);
});
