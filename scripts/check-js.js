const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const skip = new Set(['node_modules', '.git', 'miniprogram_npm']);
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
  }
}

walk(root);

for (const file of files) {
  try {
    new Function(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    error.message = `${path.relative(root, file)}: ${error.message}`;
    throw error;
  }
}

console.log(`Checked ${files.length} JavaScript files.`);
