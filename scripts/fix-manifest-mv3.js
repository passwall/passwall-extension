#!/usr/bin/env node

/**
 * Post-build script to fix Manifest V3 compatibility issues
 * 
 * This script removes the content_security_policy field from the manifest
 * because Manifest V3 uses a different CSP format and the default is sufficient.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const manifestPath = path.join(__dirname, '../dist/manifest.json');

try {
  // Read manifest
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // No CSP modifications needed - using Chrome defaults

  // Fix icon paths - use icons/ not public/icons/
  if (manifest.icons) {
    Object.keys(manifest.icons).forEach(size => {
      manifest.icons[size] = manifest.icons[size].replace('public/icons/', 'icons/');
    });
    console.log('🔧 Fixed icon paths...');
  }

  // Fix action icon paths
  if (manifest.action && manifest.action.default_icon) {
    Object.keys(manifest.action.default_icon).forEach(size => {
      manifest.action.default_icon[size] = manifest.action.default_icon[size].replace('public/icons/', 'icons/');
    });
    console.log('🔧 Fixed action icon paths...');
  }

  // Fix content script CSS path
  if (manifest.content_scripts) {
    manifest.content_scripts.forEach(script => {
      if (script.css) {
        script.css = script.css.map(path => path.replace('public/css/', 'css/'));
      }
    });
    console.log('🔧 Fixed content script CSS paths...');
  }

  // Write back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('✅ Manifest V3 fixes applied successfully!');
  console.log(`📄 Updated: ${manifestPath}`);

} catch (error) {
  console.error('❌ Error fixing manifest:', error.message);
  process.exit(1);
}

