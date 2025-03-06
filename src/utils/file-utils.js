// src/utils/file-utils.js
import fs from 'fs/promises';
import path from 'path';

export async function findHtmlFiles(directory) {
  const htmlFiles = [];

  // Check if directory exists first
  try {
    await fs.access(directory);
  } catch (error) {
    console.error(`Directory does not exist: ${directory}`);
    return htmlFiles; // Return empty array instead of crashing
  }

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
      // Continue execution instead of crashing
    }
  }

  await traverse(directory);
  return htmlFiles;
}
