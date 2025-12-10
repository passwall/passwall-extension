#!/usr/bin/env node

/**
 * Post-build script to fix Manifest V3 compatibility issues
 * 
 * This script removes the content_security_policy field from the manifest
 * because Manifest V3 uses a different CSP format and the default is sufficient.
 */

const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '../dist/manifest.json');

try {
  // Read manifest
  const manifestContent = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestContent);

  // Remove CSP (Manifest V3 default is secure enough)
  if (manifest.content_security_policy) {
    console.log('🔧 Removing content_security_policy for Manifest V3 compatibility...');
    delete manifest.content_security_policy;
  }

  // Write back
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  console.log('✅ Manifest V3 fixes applied successfully!');
  console.log(`📄 Updated: ${manifestPath}`);

} catch (error) {
  console.error('❌ Error fixing manifest:', error.message);
  process.exit(1);
}

