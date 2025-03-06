#!/usr/bin/env node
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Define the SEO tool
const SEO_ANALYZER_TOOL = {
  name: 'analyzeSEO',
  description:
    'Analyzes HTML files for SEO issues and provides recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML content to analyze (optional)',
      },
      directoryPath: {
        type: 'string',
        description: 'Path to directory to analyze (optional)',
      },
    },
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
      // Handle HTML content analysis
      if (request.params.arguments.html) {
        const html = request.params.arguments.html;
        const analysis = analyzeHtml(html, 'Provided HTML');

        return {
          content: [
            {
              type: 'text',
              text: formatAnalysisResult(analysis),
            },
          ],
        };
      }
      // Handle directory analysis
      else if (request.params.arguments.directoryPath) {
        const directoryPath = request.params.arguments.directoryPath;
        console.error(`Analyzing directory: ${directoryPath}`);

        try {
          // Check if directory exists
          try {
            await fs.access(directoryPath);
          } catch (error) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Directory "${directoryPath}" does not exist or is not accessible. Please provide a valid directory path.`,
                },
              ],
            };
          }

          // Find HTML files
          const htmlFiles = await findHtmlFiles(directoryPath);

          if (htmlFiles.length === 0) {
            // Look for index.html in common locations
            const commonLocations = [
              path.join(directoryPath, 'public', 'index.html'),
              path.join(directoryPath, 'build', 'index.html'),
              path.join(directoryPath, 'dist', 'index.html'),
              path.join(directoryPath, 'index.html'),
            ];

            for (const location of commonLocations) {
              try {
                await fs.access(location);
                htmlFiles.push(location);
                console.error(`Found index.html at ${location}`);
              } catch (error) {
                // File doesn't exist, continue checking
              }
            }

            if (htmlFiles.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No HTML files found in ${directoryPath} or common subdirectories (public, build, dist).
                    
If this is a React project, please specify the path to the public or build directory, or provide the path to a specific HTML file.`,
                  },
                ],
              };
            }
          }

          // Analyze each HTML file
          const results = [];

          for (const file of htmlFiles) {
            try {
              const content = await fs.readFile(file, 'utf8');
              const relativePath = path.relative(directoryPath, file);
              const analysis = analyzeHtml(content, relativePath);
              results.push(analysis);
            } catch (error) {
              console.error(`Error analyzing ${file}:`, error);
            }
          }

          // Format and return results
          return {
            content: [
              {
                type: 'text',
                text: formatDirectoryAnalysisResults(results, directoryPath),
              },
            ],
          };
        } catch (error) {
          console.error('Error analyzing directory:', error);
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing directory: ${error.message}`,
              },
            ],
            isError: true,
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'Please provide either HTML content or a directory path to analyze.',
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error in analyzeSEO tool:', error);
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
});

// Find HTML files in a directory
async function findHtmlFiles(directory) {
  const htmlFiles = [];

  async function traverse(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        } else if (
          entry.name.endsWith('.html') ||
          entry.name.endsWith('.htm')
        ) {
          htmlFiles.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error traversing ${dir}:`, error);
    }
  }

  await traverse(directory);
  return htmlFiles;
}

// Analyze HTML content
function analyzeHtml(html, pageIdentifier) {
  const $ = cheerio.load(html);
  const issues = [];
  const recommendations = [];

  // Basic SEO checks
  const title = $('title').text();
  const metaDescription = $('meta[name="description"]').attr('content');
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;

  // Check for React-specific elements
  const hasReactRoot =
    $('#root').length > 0 ||
    $('#app').length > 0 ||
    $('[data-reactroot]').length > 0;

  // Check title
  if (!title) {
    issues.push({ severity: 'high', message: 'Missing page title' });
    recommendations.push('Add a descriptive page title');
  } else if (title.length > 60) {
    issues.push({
      severity: 'medium',
      message: `Title length (${title.length} chars) exceeds recommended maximum of 60 characters`,
    });
    recommendations.push('Shorten title to under 60 characters');
  }

  // Check meta description
  if (!metaDescription) {
    issues.push({ severity: 'high', message: 'Missing meta description' });
    recommendations.push('Add a descriptive meta description');
  } else if (metaDescription.length < 50 || metaDescription.length > 160) {
    issues.push({
      severity: 'medium',
      message: `Meta description length (${metaDescription.length} chars) outside recommended range (50-160)`,
    });
    recommendations.push(
      'Adjust meta description to be between 50-160 characters'
    );
  }

  // Check headings
  if (h1Count === 0) {
    issues.push({ severity: 'high', message: 'No H1 heading found' });
    recommendations.push('Add an H1 heading to your page');
  } else if (h1Count > 1) {
    issues.push({
      severity: 'medium',
      message: `Multiple H1 headings found (${h1Count})`,
    });
    recommendations.push('Use only one H1 heading per page');
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

  const imagesWithoutAlt = $('img:not([alt])').length;
  if (imagesWithoutAlt > 0) {
    recommendations.push('Add alt text to all images');
  }

  // Check for schema markup
  const schemas = [];
  $('script[type="application/ld+json"]').each((i, script) => {
    try {
      const schema = JSON.parse($(script).html());
      schemas.push(schema);
    } catch (e) {
      issues.push({ severity: 'high', message: 'Invalid JSON-LD schema' });
    }
  });

  if (schemas.length === 0) {
    issues.push({
      severity: 'medium',
      message: 'No structured data (schema.org) found',
    });
    recommendations.push('Add structured data using JSON-LD');
  }

  // Check for canonical URL
  if ($('link[rel="canonical"]').length === 0) {
    issues.push({ severity: 'medium', message: 'Missing canonical URL tag' });
    recommendations.push('Add a canonical URL tag');
  }

  // Check for viewport meta tag
  if ($('meta[name="viewport"]').length === 0) {
    issues.push({ severity: 'medium', message: 'Missing viewport meta tag' });
    recommendations.push('Add a viewport meta tag for better mobile rendering');
  }

  // Check for social media tags
  const hasOgTags = $('meta[property^="og:"]').length > 0;
  const hasTwitterTags = $('meta[name^="twitter:"]').length > 0;

  if (!hasOgTags) {
    issues.push({ severity: 'low', message: 'Missing Open Graph meta tags' });
    recommendations.push(
      'Add Open Graph meta tags for better social media sharing'
    );
  }

  if (!hasTwitterTags) {
    issues.push({ severity: 'low', message: 'Missing Twitter Card meta tags' });
    recommendations.push(
      'Add Twitter Card meta tags for better Twitter sharing'
    );
  }

  // React-specific recommendations
  if (hasReactRoot) {
    issues.push({
      severity: 'info',
      message:
        'This appears to be a React application with client-side rendering',
    });
    recommendations.push(
      'Consider using server-side rendering (Next.js) or static site generation (Gatsby) for better SEO'
    );
    recommendations.push(
      'Note: This analysis is limited to the static HTML. The rendered content may differ.'
    );
  }

  return {
    pageIdentifier,
    title,
    metaDescription,
    headingStructure: {
      h1: h1Count,
      h2: h2Count,
      h3: h3Count,
    },
    schemaCount: schemas.length,
    issues,
    recommendations,
    isReactApp: hasReactRoot,
  };
}

// Format a single analysis result
function formatAnalysisResult(result) {
  return `SEO ANALYSIS FOR: ${result.pageIdentifier}

PAGE INFO:
- Title: ${result.title || 'Missing'} (${
    result.title ? result.title.length : 0
  } chars)
- Meta Description: ${result.metaDescription || 'Missing'} (${
    result.metaDescription ? result.metaDescription.length : 0
  } chars)
- Heading Structure: H1: ${result.headingStructure.h1}, H2: ${
    result.headingStructure.h2
  }, H3: ${result.headingStructure.h3}
- Schema Count: ${result.schemaCount}
${result.isReactApp ? '- React App: Yes (client-side rendering detected)' : ''}

ISSUES:
${result.issues
  .map((issue) => `- [${issue.severity.toUpperCase()}] ${issue.message}`)
  .join('\n')}

RECOMMENDATIONS:
${result.recommendations.map((rec) => `- ${rec}`).join('\n')}

${
  result.isReactApp
    ? '\nNOTE: This is a static HTML analysis. For JavaScript-heavy sites like React apps, the rendered content may differ from the static HTML.'
    : ''
}`;
}

// Format directory analysis results
function formatDirectoryAnalysisResults(results, directoryPath) {
  let output = `SEO ANALYSIS FOR DIRECTORY: ${directoryPath}\n\n`;

  output += `Analyzed ${results.length} HTML files\n\n`;

  // Count issues by severity
  const issueCounts = {
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };

  results.forEach((result) => {
    result.issues.forEach((issue) => {
      if (issue.severity in issueCounts) {
        issueCounts[issue.severity]++;
      }
    });
  });

  output += `ISSUE SUMMARY:\n`;
  output += `- High: ${issueCounts.high}\n`;
  output += `- Medium: ${issueCounts.medium}\n`;
  output += `- Low: ${issueCounts.low}\n`;
  output += `- Info: ${issueCounts.info}\n\n`;

  // Check if any React apps were detected
  const reactApps = results.filter((r) => r.isReactApp);
  if (reactApps.length > 0) {
    output += `REACT APPLICATIONS DETECTED: ${reactApps.length} files\n`;
    output += `Note: For React applications, this analysis is limited to the static HTML. The rendered content may differ.\n`;
    output += `Consider using server-side rendering (Next.js) or static site generation (Gatsby) for better SEO.\n\n`;
  }

  // Individual file results
  results.forEach((result, index) => {
    output += `FILE ${index + 1}: ${result.pageIdentifier}\n`;
    output += `- Title: ${result.title || 'Missing'} (${
      result.title ? result.title.length : 0
    } chars)\n`;
    output += `- Meta Description: ${result.metaDescription || 'Missing'} (${
      result.metaDescription ? result.metaDescription.length : 0
    } chars)\n`;
    output += `- Heading Structure: H1: ${result.headingStructure.h1}, H2: ${result.headingStructure.h2}, H3: ${result.headingStructure.h3}\n`;
    output += `- Schema Count: ${result.schemaCount}\n`;
    output += `- Issues: ${result.issues.length}\n\n`;
  });

  // Common recommendations
  const allRecommendations = new Set();
  results.forEach((result) => {
    result.recommendations.forEach((rec) => {
      allRecommendations.add(rec);
    });
  });

  output += `COMMON RECOMMENDATIONS:\n`;
  Array.from(allRecommendations).forEach((rec) => {
    output += `- ${rec}\n`;
  });

  return output;
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
