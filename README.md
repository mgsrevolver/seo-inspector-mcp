// README.md - Instructions for setup and use

# SEO Inspector & Schema Validator MCP

A Model Context Protocol (MCP) server for Cursor that analyzes web pages for SEO issues and validates structured data schemas.

## Features

- Analyze HTML files in a codebase for SEO issues
- Validate JSON-LD structured data
- Get recommendations to improve SEO
- No browser extension required - works directly with your codebase

## Installation

1. Clone this repository:

   ```
   git clone https://github.com/yourusername/seo-inspector-mcp.git
   cd seo-inspector-mcp
   ```

2. Install dependencies:

   ```
   npm install
   ```

3. Configure Cursor to use this MCP server:
   - Go to Settings > Features > MCP in Cursor
   - Add a new MCP server with:
     - Name: SEO Inspector
     - Type: sse
     - URL: http://localhost:8767/sse

## Usage

1. Start the MCP server:

   ```
   ./run-mcp.sh
   ```

2. In Cursor, you can now use the SEO Inspector tools:
   - `seo.analyze-codebase` - Analyze HTML files in a directory
   - `seo.analyze-html` - Analyze a specific HTML string

## Prioritized SEO Components

The tool checks for these key SEO elements (in order of importance):

### Critical

- Page Title
- Meta Description
- H1 Heading
- Canonical URL

### Important

- Heading Structure (H2-H6)
- Image Alt Text
- Structured Data (JSON-LD)
- Robots Directives

### Recommended

- Open Graph Tags
- Twitter Cards
- Internal Linking
- URL Structure
- Mobile Friendliness

## Schema Validation

The tool validates the following schema types:

- Organization
- LocalBusiness
- Product
- Article
- WebPage
- FAQPage
- Event
- Recipe
- Review

## License

MIT
