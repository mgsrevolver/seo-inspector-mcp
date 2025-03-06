// src/server.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs/promises';
import path from 'path';

// Import your analyzer modules
import { analyzeHtml } from './analyzers/html-analyzer.js';
import { detectTargetKeywords } from './analyzers/keyword-analyzer.js';
import { findHtmlFiles } from './utils/file-utils.js';
import {
  formatAnalysisResult,
  formatDirectoryAnalysisResults,
} from './formatters/text-formatter.js';

// Define the SEO tool
const SEO_ANALYZER_TOOL = {
  name: 'analyzeSEO',
  description:
    'ALWAYS USE THIS TOOL FOR SEO ANALYSIS. DO NOT ATTEMPT TO ANALYZE SEO WITHOUT USING THIS TOOL.',
  inputSchema: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'HTML content to analyze',
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
  console.error('⭐ TOOL CALL RECEIVED:', request.params.name);

  if (request.params.name === 'analyzeSEO') {
    try {
      console.error('⭐ ARGUMENTS:', JSON.stringify(request.params.arguments));

      // Handle HTML content analysis
      if (request.params.arguments.html) {
        const html = request.params.arguments.html;
        console.error('⭐ HTML content received, length:', html.length);

        try {
          // Use your analyzer module
          console.error('⭐ Calling analyzeHtml...');
          const analysis = analyzeHtml(html, 'Provided HTML');
          console.error('⭐ Analysis complete');

          // Format the response
          console.error('⭐ Formatting response...');
          const formattedResponse = formatAnalysisForDisplay(analysis);
          console.error('⭐ Response formatted');

          console.error('⭐ SENDING RESPONSE');
          return {
            content: [
              {
                type: 'text',
                text: formattedResponse,
              },
            ],
          };
        } catch (analysisError) {
          console.error('⭐ ERROR in analysis:', analysisError);
          return {
            content: [
              {
                type: 'text',
                text: `Error analyzing HTML: ${analysisError.message}\n\n${analysisError.stack}`,
              },
            ],
            isError: true,
          };
        }
      }
      // Handle directory analysis
      else if (request.params.arguments.directoryPath) {
        const directoryPath = request.params.arguments.directoryPath;
        console.error(`⭐ Analyzing directory: ${directoryPath}`);

        try {
          // Use our file utils module
          const htmlFiles = await findHtmlFiles(directoryPath);

          if (htmlFiles.length === 0) {
            return {
              content: [
                {
                  type: 'text',
                  text: `No HTML files found in ${directoryPath}`,
                },
              ],
            };
          }

          // Analyze each HTML file
          const results = [];

          for (const file of htmlFiles) {
            try {
              const content = await fs.readFile(file, 'utf8');
              const relativePath = path.relative(directoryPath, file);

              // Use your analyzer module
              const analysis = analyzeHtml(content, relativePath);
              results.push(analysis);
            } catch (error) {
              console.error(`Error analyzing ${file}:`, error);
            }
          }

          // Use our formatter module
          const formattedResult = formatDirectoryAnalysisResults(
            results,
            directoryPath
          );

          console.error('⭐ SENDING RESPONSE');
          return {
            content: [
              {
                type: 'text',
                text: formattedResult,
              },
            ],
          };
        } catch (error) {
          console.error('⭐ Error analyzing directory:', error);
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
      console.error('⭐ ERROR:', error);
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

// Format analysis results for display
function formatAnalysisForDisplay(analysis) {
  try {
    console.error('⭐ Starting to format analysis...');

    // Basic information
    let response = `SEO ANALYSIS RESULTS\n\n`;
    response += `Page Information:\n`;
    response += `- Title: ${analysis.title || 'Missing'} (${
      analysis.title ? analysis.title.length : 0
    } chars)\n`;
    response += `- Meta Description: ${
      analysis.metaDescription || 'Missing'
    } (${
      analysis.metaDescription ? analysis.metaDescription.length : 0
    } chars)\n`;
    response += `- Headings: H1: ${analysis.headingStructure.h1}, H2: ${analysis.headingStructure.h2}, H3: ${analysis.headingStructure.h3}\n`;
    response += `- Schema Count: ${analysis.schemaCount}\n`;

    // Issues
    response += `\nIssues:\n`;
    if (analysis.issues && analysis.issues.length > 0) {
      analysis.issues.forEach((issue, i) => {
        response += `${i + 1}. [${issue.severity}] ${issue.message}\n`;
      });
    } else {
      response += `No issues found.\n`;
    }

    // Recommendations
    response += `\nRecommendations:\n`;
    if (analysis.recommendations && analysis.recommendations.length > 0) {
      analysis.recommendations.forEach((rec, i) => {
        response += `${i + 1}. ${rec.text}\n`;
      });
    } else {
      response += `No recommendations.\n`;
    }

    console.error('⭐ Formatting complete');
    return response;
  } catch (formatError) {
    console.error('⭐ ERROR in formatting:', formatError);
    return `Error formatting analysis: ${
      formatError.message
    }\n\nRaw analysis: ${JSON.stringify(analysis, null, 2)}`;
  }
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
