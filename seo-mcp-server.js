#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as cheerio from 'cheerio';
import path from 'path';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Define the SEO tool
const SEO_ANALYZER_TOOL = {
  name: 'analyzeSEO',
  description:
    'Comprehensive SEO analysis for any web project. Intelligently detects tech stack and pre-renders JavaScript applications for accurate analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description:
          'HTML content to analyze (optional if directoryPath or url is provided)',
      },
      url: {
        type: 'string',
        description:
          'URL to analyze (optional if html or directoryPath is provided)',
      },
      directoryPath: {
        type: 'string',
        description:
          'Path to directory containing the web project to analyze (optional if html or url is provided)',
      },
      preRender: {
        type: 'boolean',
        description:
          'Whether to pre-render JavaScript applications (default: true)',
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
      // Determine if pre-rendering is enabled (default to true)
      const preRender = request.params.arguments.preRender !== false;

      if (request.params.arguments.html) {
        // Simple HTML analysis
        const result = analyzeHtml(
          request.params.arguments.html,
          request.params.arguments.url || 'example.com'
        );

        return {
          content: [
            {
              type: 'text',
              text: formatSeoAnalysis(result),
            },
          ],
        };
      } else if (request.params.arguments.url) {
        // URL analysis with pre-rendering
        console.error(`Analyzing URL: ${request.params.arguments.url}`);

        if (preRender) {
          const renderedPage = await preRenderWithPuppeteer(
            request.params.arguments.url
          );
          const result = analyzeHtml(renderedPage.html, renderedPage.url);
          result.isPreRendered = true;

          return {
            content: [
              {
                type: 'text',
                text: formatSeoAnalysis(result),
              },
            ],
          };
        } else {
          // Without pre-rendering, we'd need to fetch the HTML directly
          // This is a simplified version - in reality, you'd use fetch or axios
          return {
            content: [
              {
                type: 'text',
                text: 'Pre-rendering is disabled. Please enable pre-rendering to analyze URLs.',
              },
            ],
          };
        }
      } else if (request.params.arguments.directoryPath) {
        // Project analysis
        console.error(
          `Analyzing project directory: ${request.params.arguments.directoryPath}`
        );

        // Check if it's a JS project that needs pre-rendering
        const techStack = await detectTechStack(
          request.params.arguments.directoryPath
        );

        if (techStack.framework && preRender) {
          // It's a JS project and pre-rendering is enabled
          console.error(
            `Detected ${techStack.framework} project. Attempting pre-rendering...`
          );

          try {
            const analysis = await analyzeJsProject(
              request.params.arguments.directoryPath
            );

            return {
              content: [
                {
                  type: 'text',
                  text: formatSeoAnalysisWithTechStack(analysis),
                },
              ],
            };
          } catch (error) {
            console.error('Error analyzing JS project:', error);

            // Fall back to static analysis
            console.error('Falling back to static HTML analysis...');
            const htmlFiles = await findHtmlFiles(
              request.params.arguments.directoryPath
            );

            if (htmlFiles.length === 0) {
              return {
                content: [
                  {
                    type: 'text',
                    text: `No HTML files found in ${request.params.arguments.directoryPath}. Pre-rendering failed with error: ${error.message}`,
                  },
                ],
              };
            }

            const file = htmlFiles[0]; // Analyze the first HTML file
            const content = await fs.readFile(file, 'utf8');
            const result = analyzeHtml(content, path.basename(file));

            // Add tech stack info
            result.techStack = techStack;
            result.preRenderingFailed = true;
            result.recommendations.push(
              'Pre-rendering failed. Consider building the project first or checking for errors.'
            );

            return {
              content: [
                {
                  type: 'text',
                  text: formatSeoAnalysisWithTechStack(result),
                },
              ],
            };
          }
        } else {
          // It's not a JS project or pre-rendering is disabled
          // Perform static HTML analysis
          const htmlFiles = await findHtmlFiles(
            request.params.arguments.directoryPath
          );

          if (htmlFiles.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No HTML files found in ${request.params.arguments.directoryPath}`,
                },
              ],
            };
          }

          // Analyze all HTML files
          const analyses = [];

          for (const file of htmlFiles) {
            const content = await fs.readFile(file, 'utf8');
            const result = analyzeHtml(
              content,
              path.relative(request.params.arguments.directoryPath, file)
            );
            analyses.push(result);
          }

          return {
            content: [
              {
                type: 'text',
                text: formatMultipleAnalyses(analyses, techStack),
              },
            ],
          };
        }
      } else {
        return {
          content: [
            {
              type: 'text',
              text: 'Please provide either HTML content, a URL, or a directory path to analyze.',
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

  // Handle other tools...
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

// Add this function to detect if it's a React project
async function isReactProject(directoryPath) {
  try {
    // Check for package.json with React dependency
    const packageJsonPath = path.join(directoryPath, 'package.json');
    const packageJsonExists = await fs
      .access(packageJsonPath)
      .then(() => true)
      .catch(() => false);

    if (packageJsonExists) {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf8')
      );
      if (
        packageJson.dependencies &&
        (packageJson.dependencies.react || packageJson.devDependencies?.react)
      ) {
        return true;
      }
    }

    // Check for typical React project structure
    const srcFolderExists = await fs
      .access(path.join(directoryPath, 'src'))
      .then(() => true)
      .catch(() => false);
    const publicFolderExists = await fs
      .access(path.join(directoryPath, 'public'))
      .then(() => true)
      .catch(() => false);

    if (srcFolderExists && publicFolderExists) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error detecting React project:', error);
    return false;
  }
}

// Modify the findHtmlFiles function to be React-aware
async function findHtmlFiles(directory) {
  const htmlFiles = [];

  // Check if this is a React project
  const reactProject = await isReactProject(directory);

  if (reactProject) {
    console.error('Detected React project - focusing on index.html');

    // Look for index.html in common React locations
    const possibleLocations = [
      path.join(directory, 'public', 'index.html'),
      path.join(directory, 'index.html'),
      path.join(directory, 'dist', 'index.html'),
      path.join(directory, 'build', 'index.html'),
    ];

    for (const location of possibleLocations) {
      try {
        await fs.access(location);
        htmlFiles.push(location);
        console.error(`Found React index.html at ${location}`);
        break; // Stop after finding the first one
      } catch (error) {
        // File doesn't exist, try next location
      }
    }

    if (htmlFiles.length === 0) {
      console.error('No index.html found in typical React locations');
    }

    return htmlFiles;
  }

  // For non-React projects, use the original directory traversal
  async function traverse(dir) {
    const files = await fs.readdir(dir, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dir, file.name);

      // Skip node_modules and other common build directories
      if (file.isDirectory()) {
        if (
          ['node_modules', '.git', 'dist', 'build', '.next'].includes(file.name)
        ) {
          continue;
        }
        await traverse(filePath);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        htmlFiles.push(filePath);
      }
    }
  }

  await traverse(directory);
  return htmlFiles;
}

// Update the analyzeHtmlFile function to provide more context for React projects
async function analyzeHtmlFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const isIndexHtml = fileName === 'index.html';

  const analysis = analyzeHtml(content, filePath);

  // Add React-specific context if it's index.html
  if (isIndexHtml) {
    analysis.isReactIndexHtml = true;
    analysis.note =
      "This is likely a React app's index.html. Remember that React apps often inject content dynamically, so some SEO elements might be added at runtime.";

    // Check for common React SEO issues
    if (
      !content.includes('data-react-helmet') &&
      !content.includes('react-helmet')
    ) {
      analysis.recommendations.push(
        'Consider using react-helmet for managing document head in React'
      );
    }

    if (!content.includes('robots') && !content.includes('googlebot')) {
      analysis.recommendations.push(
        'Add meta robots tags for search engine crawling instructions'
      );
    }
  }

  return {
    filePath,
    ...analysis,
  };
}

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
  } else if (title.length > 60) {
    issues.push({
      severity: 'medium',
      message: `Title length (${title.length} chars) exceeds recommended maximum of 60 characters`,
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

// Add this function to pre-render a page using Puppeteer
async function preRenderWithPuppeteer(url, waitTime = 5000) {
  console.error(`Pre-rendering ${url} with Puppeteer...`);
  let browser = null;

  try {
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    // Set viewport to desktop size
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait additional time for any delayed JavaScript execution
    await page.waitForTimeout(waitTime);

    // Get the fully rendered HTML
    const renderedHtml = await page.content();

    // Get the page title
    const title = await page.title();

    // Close the browser
    await browser.close();
    browser = null;

    return {
      html: renderedHtml,
      title,
      url,
    };
  } catch (error) {
    console.error('Error pre-rendering with Puppeteer:', error);
    if (browser) await browser.close();
    throw error;
  }
}

// Function to start a development server for a project
async function startDevServer(directoryPath) {
  try {
    console.error('Attempting to start development server...');

    // Check package.json for start script
    const packageJsonPath = path.join(directoryPath, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

    let startCommand = null;
    let port = 3000; // Default port

    if (packageJson.scripts) {
      if (packageJson.scripts.dev) {
        startCommand = 'npm run dev';
      } else if (packageJson.scripts.start) {
        startCommand = 'npm run start';
      } else if (packageJson.scripts.serve) {
        startCommand = 'npm run serve';
      }
    }

    if (!startCommand) {
      console.error('No start script found in package.json');
      return null;
    }

    // Try to determine the port from the start command or config files
    // This is a simplistic approach - in reality, you'd need to parse the command or config files
    if (packageJson.scripts && startCommand) {
      const scriptContent =
        packageJson.scripts[startCommand.replace('npm run ', '')];
      if (scriptContent) {
        const portMatch = scriptContent.match(/--port[=\s](\d+)/);
        if (portMatch && portMatch[1]) {
          port = parseInt(portMatch[1], 10);
        }
      }
    }

    // Start the server in a detached process
    console.error(`Starting dev server with command: ${startCommand}`);
    const process = exec(startCommand, { cwd: directoryPath });

    // Return server info
    return {
      process,
      port,
      url: `http://localhost:${port}`,
    };
  } catch (error) {
    console.error('Error starting development server:', error);
    return null;
  }
}

// Function to analyze a React/JS project with pre-rendering
async function analyzeJsProject(directoryPath) {
  let server = null;

  try {
    // 1. Detect if it's a JS project
    const techStack = await detectTechStack(directoryPath);
    console.error('Detected tech stack:', techStack);

    // 2. Start a development server
    server = await startDevServer(directoryPath);
    if (!server) {
      throw new Error('Could not start development server');
    }

    // 3. Wait for server to be ready (simple approach - in reality, you'd poll the URL)
    console.error(`Waiting for server to be ready at ${server.url}...`);
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 4. Use Puppeteer to render the page
    const renderedPage = await preRenderWithPuppeteer(server.url);

    // 5. Analyze the rendered HTML
    const analysis = analyzeHtml(renderedPage.html, renderedPage.url);

    // 6. Add tech stack information to the analysis
    analysis.techStack = techStack;
    analysis.isPreRendered = true;

    // 7. Add specific recommendations based on tech stack
    if (techStack.framework) {
      if (
        techStack.framework.includes('React') &&
        !techStack.seoTools.includes('React Helmet')
      ) {
        analysis.recommendations.push(
          'Consider using React Helmet for better meta tag management'
        );
      }

      if (techStack.rendering === 'CSR (Client-side rendering)') {
        analysis.recommendations.push(
          'Consider implementing server-side rendering (SSR) or static site generation (SSG) for better SEO'
        );

        if (techStack.framework.includes('React')) {
          analysis.recommendations.push(
            'Next.js provides built-in SSR/SSG capabilities for React applications'
          );
        } else if (techStack.framework.includes('Vue')) {
          analysis.recommendations.push(
            'Nuxt.js provides built-in SSR/SSG capabilities for Vue applications'
          );
        }
      }
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing JS project:', error);
    throw error;
  } finally {
    // Clean up: stop the development server
    if (server && server.process) {
      console.error('Stopping development server...');
      server.process.kill();
    }
  }
}

// Function to detect the tech stack
async function detectTechStack(directoryPath) {
  const techStack = {
    framework: null,
    rendering: null,
    router: null,
    seoTools: [],
    buildTool: null,
  };

  try {
    // Check package.json
    const packageJsonPath = path.join(directoryPath, 'package.json');
    const packageJsonExists = await fs
      .access(packageJsonPath)
      .then(() => true)
      .catch(() => false);

    if (packageJsonExists) {
      const packageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf8')
      );
      const deps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Framework detection
      if (deps.react) techStack.framework = 'React';
      else if (deps.vue) techStack.framework = 'Vue';
      else if (deps.angular) techStack.framework = 'Angular';
      else if (deps.svelte) techStack.framework = 'Svelte';

      // Rendering approach
      if (deps.next) {
        techStack.framework = 'Next.js (React)';
        techStack.rendering = 'SSR/SSG';
      } else if (deps.gatsby) {
        techStack.framework = 'Gatsby (React)';
        techStack.rendering = 'SSG';
      } else if (deps.nuxt) {
        techStack.framework = 'Nuxt.js (Vue)';
        techStack.rendering = 'SSR/SSG';
      } else if (deps['@angular/universal']) {
        techStack.rendering = 'SSR';
      } else if (deps['react-snap'] || deps.prerender) {
        techStack.rendering = 'Pre-rendered';
      } else if (techStack.framework) {
        techStack.rendering = 'CSR (Client-side rendering)';
      }

      // Router detection
      if (deps['react-router'] || deps['react-router-dom'])
        techStack.router = 'React Router';
      else if (deps['vue-router']) techStack.router = 'Vue Router';
      else if (deps['@angular/router']) techStack.router = 'Angular Router';
      else if (deps.next || deps.gatsby || deps.nuxt)
        techStack.router = 'Built-in routing';

      // SEO tools
      if (deps['react-helmet']) techStack.seoTools.push('React Helmet');
      if (deps['react-helmet-async'])
        techStack.seoTools.push('React Helmet Async');
      if (deps['next-seo']) techStack.seoTools.push('Next SEO');
      if (deps['vue-meta']) techStack.seoTools.push('Vue Meta');
      if (deps['react-snap']) techStack.seoTools.push('React Snap');
      if (deps.prerender) techStack.seoTools.push('Prerender');

      // Build tools
      if (deps.webpack) techStack.buildTool = 'Webpack';
      else if (deps.vite) techStack.buildTool = 'Vite';
      else if (deps.parcel) techStack.buildTool = 'Parcel';
      else if (deps['@angular/cli']) techStack.buildTool = 'Angular CLI';
    }

    // Check for config files if package.json didn't give us enough info
    if (!techStack.framework) {
      const files = await fs.readdir(directoryPath);
      if (files.includes('angular.json')) techStack.framework = 'Angular';
      else if (files.includes('vue.config.js')) techStack.framework = 'Vue';
      else if (files.includes('gatsby-config.js'))
        techStack.framework = 'Gatsby (React)';
      else if (files.includes('next.config.js'))
        techStack.framework = 'Next.js (React)';
      else if (files.includes('nuxt.config.js'))
        techStack.framework = 'Nuxt.js (Vue)';
      else if (
        (await fileExists(path.join(directoryPath, 'src', 'App.jsx'))) ||
        (await fileExists(path.join(directoryPath, 'src', 'App.tsx'))) ||
        (await fileExists(path.join(directoryPath, 'src', 'App.js')))
      ) {
        techStack.framework = 'React (likely)';
      }
    }

    return techStack;
  } catch (error) {
    console.error('Error detecting tech stack:', error);
    return techStack;
  }
}

async function fileExists(filePath) {
  return fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
}

// Format SEO analysis with tech stack information
function formatSeoAnalysisWithTechStack(result) {
  let markdown = formatSeoAnalysis(result);

  // Add tech stack information if available
  if (result.techStack) {
    const techStackInfo = `
## Technology Stack

- **Framework**: ${result.techStack.framework || 'Not detected'}
- **Rendering Approach**: ${result.techStack.rendering || 'Not detected'}
- **Routing**: ${result.techStack.router || 'Not detected'}
${
  result.techStack.seoTools && result.techStack.seoTools.length > 0
    ? `- **SEO Tools**: ${result.techStack.seoTools.join(', ')}`
    : '- **SEO Tools**: None detected'
}
- **Build Tool**: ${result.techStack.buildTool || 'Not detected'}
${result.isPreRendered ? '- **Analysis**: Based on pre-rendered page ✅' : ''}
${
  result.preRenderingFailed
    ? '- **Analysis**: Pre-rendering failed, using static HTML ⚠️'
    : ''
}

`;

    // Insert tech stack info after the first heading
    const firstHeadingEnd = markdown.indexOf('\n\n', markdown.indexOf('#'));
    if (firstHeadingEnd !== -1) {
      markdown =
        markdown.slice(0, firstHeadingEnd + 2) +
        techStackInfo +
        markdown.slice(firstHeadingEnd + 2);
    } else {
      markdown = markdown + '\n' + techStackInfo;
    }
  }

  return markdown;
}

// Format multiple analyses
function formatMultipleAnalyses(analyses, techStack) {
  let markdown = `# SEO Analysis Summary\n\n`;

  // Add tech stack information if available
  if (techStack && techStack.framework) {
    markdown += `## Technology Stack\n\n`;
    markdown += `- **Framework**: ${techStack.framework || 'Not detected'}\n`;
    markdown += `- **Rendering Approach**: ${
      techStack.rendering || 'Not detected'
    }\n`;
    markdown += `- **Routing**: ${techStack.router || 'Not detected'}\n`;

    if (techStack.seoTools && techStack.seoTools.length > 0) {
      markdown += `- **SEO Tools**: ${techStack.seoTools.join(', ')}\n`;
    } else {
      markdown += `- **SEO Tools**: None detected\n`;
    }

    markdown += `- **Build Tool**: ${
      techStack.buildTool || 'Not detected'
    }\n\n`;
  }

  // Count total issues by severity
  const totalIssues = {
    high: 0,
    medium: 0,
    low: 0,
  };

  analyses.forEach((analysis) => {
    analysis.issues.forEach((issue) => {
      if (issue.severity in totalIssues) {
        totalIssues[issue.severity]++;
      }
    });
  });

  // Display issue summary
  markdown += `## Issues Summary\n\n`;
  markdown += `- 🔴 High: ${totalIssues.high}\n`;
  markdown += `- 🟠 Medium: ${totalIssues.medium}\n`;
  markdown += `- 🟢 Low: ${totalIssues.low}\n\n`;

  // Display individual file results
  analyses.forEach((analysis, index) => {
    markdown += `## ${index + 1}. ${analysis.pageIdentifier}\n\n`;

    // Add title and meta description info
    markdown += `- **Title**: ${analysis.title || 'Missing'} ${
      analysis.title ? `(${analysis.title.length} chars)` : ''
    }\n`;
    markdown += `- **Meta Description**: ${
      analysis.metaDescription || 'Missing'
    } ${
      analysis.metaDescription
        ? `(${analysis.metaDescription.length} chars)`
        : ''
    }\n`;
    markdown += `- **Issues**: ${analysis.issues.length}\n\n`;

    // Add collapsible details
    markdown += `<details>\n<summary>View detailed analysis</summary>\n\n`;

    // Add heading structure
    markdown += `### Heading Structure\n\n`;
    markdown += `- H1: ${analysis.headingStructure.h1}\n`;
    markdown += `- H2: ${analysis.headingStructure.h2}\n`;
    markdown += `- H3: ${analysis.headingStructure.h3}\n\n`;

    // Add issues
    if (analysis.issues.length > 0) {
      markdown += `### Issues\n\n`;
      analysis.issues.forEach((issue, i) => {
        const indicator =
          issue.severity === 'high'
            ? '🔴'
            : issue.severity === 'medium'
            ? '🟠'
            : '🟢';
        markdown += `${
          i + 1
        }. ${indicator} **${issue.severity.toUpperCase()}**: ${
          issue.message
        }\n`;
      });
      markdown += '\n';
    }

    // Add recommendations
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      markdown += `### Recommendations\n\n`;
      analysis.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. 💡 ${rec}\n`;
      });
      markdown += '\n';
    }

    markdown += `</details>\n\n`;
  });

  return markdown;
}

// Format a single SEO analysis
function formatSeoAnalysis(result) {
  return `# SEO Analysis for: ${result.pageIdentifier}

## Page Information
- **Title**: ${result.title || 'Missing'} ${
    result.title ? `(${result.title.length} chars)` : ''
  }
- **Meta Description**: ${result.metaDescription || 'Missing'} ${
    result.metaDescription ? `(${result.metaDescription.length} chars)` : ''
  }

## Heading Structure
- H1: ${result.headingStructure.h1}
- H2: ${result.headingStructure.h2}
- H3: ${result.headingStructure.h3}

## Schema Markup
- Schema Count: ${result.schemaCount}

## Issues Found (${result.issues.length})
${result.issues.length === 0 ? '✅ No issues found!' : ''}
${result.issues
  .map((issue, index) => {
    const indicator =
      issue.severity === 'high'
        ? '🔴'
        : issue.severity === 'medium'
        ? '🟠'
        : '🟢';
    return `${index + 1}. ${indicator} **${issue.severity.toUpperCase()}**: ${
      issue.message
    }`;
  })
  .join('\n')}

${
  result.recommendations && result.recommendations.length > 0
    ? `
## Recommendations
${result.recommendations
  .map((rec, index) => `${index + 1}. 💡 ${rec}`)
  .join('\n')}
`
    : ''
}
`;
}
