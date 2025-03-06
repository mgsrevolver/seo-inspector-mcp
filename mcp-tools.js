// mcp-tools.js - The interface for Cursor MCP
const MCP_TOOLS = {
  namespace: 'seo',
  displayName: 'SEO Inspector',
  description: 'Analyze web pages for SEO issues and validate structured data',
  tools: [
    {
      name: 'analyze-codebase',
      description: 'Scan HTML files in a directory for SEO issues',
      parameters: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description:
              'Path to the directory containing HTML files to analyze',
          },
        },
        required: ['directoryPath'],
      },
      handler: async ({ directoryPath }) => {
        // This will be implemented in the MCP framework
        // The actual implementation is in the /analyze-codebase endpoint
      },
    },
    {
      name: 'analyze-html',
      description: 'Analyze a specific HTML string for SEO issues',
      parameters: {
        type: 'object',
        properties: {
          html: {
            type: 'string',
            description: 'HTML content to analyze',
          },
          url: {
            type: 'string',
            description: 'Optional URL for context',
          },
        },
        required: ['html'],
      },
      handler: async ({ html, url }) => {
        // This will be implemented in the MCP framework
        // The actual implementation is in the /analyze-html endpoint
      },
    },
  ],
};

module.exports = MCP_TOOLS;
