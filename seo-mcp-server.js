#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as cheerio from 'cheerio';

// Define the SEO tool
const SEO_ANALYZER_TOOL = {
  name: 'analyzeSEO',
  description: 'Analyze HTML content for SEO issues',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML content to analyze',
      },
      url: {
        type: 'string',
        description: 'URL or identifier for the HTML content',
      },
    },
    required: ['html'],
  },
};

// Create the server
const server = new Server(
  {
    name: 'seo-inspector-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing requests
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SEO_ANALYZER_TOOL],
}));

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === 'analyzeSEO') {
    try {
      const result = analyzeHtml(
        request.params.arguments.html,
        request.params.arguments.url || 'example.com'
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error analyzing SEO:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error analyzing SEO: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

// Function to analyze HTML
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

// Start the server
async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SEO Inspector MCP Server running on stdio');
}

runServer().catch((error) => {
  console.error('Fatal error running server:', error);
  process.exit(1);
});
