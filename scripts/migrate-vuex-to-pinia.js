#!/usr/bin/env node

/**
 * Automated Vuex to Pinia migration script
 * This script helps convert common Vuex patterns to Pinia in Vue files
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Store name mappings
const storeMap = {
  'Logins': 'logins',
  'CreditCards': 'creditCards',
  'Emails': 'emails',
  'BankAccounts': 'bankAccounts',
  'Notes': 'notes',
  'Servers': 'servers',
  'ChangeMasterPassword': 'changeMasterPassword',
  'Migration': 'migration'
};

function migrateFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if file uses Vuex
  if (!content.includes('from \'vuex\'') && !content.includes('from "vuex"')) {
    return false;
  }

  console.log(`📝 Migrating: ${filePath}`);

  // Detect which stores are being used
  const usedStores = new Set();
  
  // Check for mapState/mapActions usage
  Object.keys(storeMap).forEach(storeName => {
    const patterns = [
      new RegExp(`mapState\\(['"${storeName}['"]`, 'g'),
      new RegExp(`mapActions\\(['"${storeName}['"]`, 'g'),
      new RegExp(`mapGetters\\(['"${storeName}['"]`, 'g')
    ];
    
    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        usedStores.add(storeName);
      }
    });
  });

  // Check for root store usage (no namespace)
  const hasRootStore = /mapState\(\[/.test(content) || /mapGetters\(\[/.test(content) || /mapMutations\(\[/.test(content);
  
  console.log(`  Stores used: ${Array.from(usedStores).join(', ')} ${hasRootStore ? '+ root' : ''}`);

  // Generate imports
  let imports = [];
  if (hasRootStore) {
    imports.push(`import { useAuthStore } from '@/stores/auth'`);
  }
  usedStores.forEach(storeName => {
    const piniaStoreName = storeMap[storeName];
    const camelCase = piniaStoreName.charAt(0).toUpperCase() + piniaStoreName.slice(1);
    imports.push(`import { use${camelCase}Store } from '@/stores/${piniaStoreName}'`);
  });
  imports.push(`import { storeToRefs } from 'pinia'`);

  // Replace Vuex imports
  content = content.replace(
    /import\s+\{[^}]*\}\s+from\s+['"]vuex['"]/,
    imports.join('\n')
  );

  // Add setup function if not exists
  if (!content.includes('setup()')) {
    // Find export default { position
    const exportMatch = content.match(/export default \{/);
    if (exportMatch) {
      let setupCode = '\n  setup() {\n';
      
      if (hasRootStore) {
        setupCode += '    const authStore = useAuthStore()\n';
      }
      
      usedStores.forEach(storeName => {
        const piniaStoreName = storeMap[storeName];
        const camelCase = piniaStoreName.charAt(0).toUpperCase() + piniaStoreName.slice(1);
        setupCode += `    const ${piniaStoreName}Store = use${camelCase}Store()\n`;
      });
      
      setupCode += '\n    return {\n';
      
      if (hasRootStore) {
        setupCode += '      authStore,\n';
      }
      
      usedStores.forEach(storeName => {
        const piniaStoreName = storeMap[storeName];
        setupCode += `      ${piniaStoreName}Store,\n`;
      });
      
      setupCode += '    }\n  },';
      
      content = content.replace('export default {', `export default {${setupCode}`);
      modified = true;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✅ Migrated`);
  
  return modified;
}

// Find all Vue files
const files = [
  ...glob.sync('src/popup/views/**/*.vue'),
  ...glob.sync('src/components/*.vue')
];

console.log(`Found ${files.length} Vue files to check\n`);

let migratedCount = 0;
files.forEach(file => {
  if (migrateFile(file)) {
    migratedCount++;
  }
});

console.log(`\n✅ Migration complete!`);
console.log(`📊 Migrated ${migratedCount} files`);
console.log(`\n⚠️  Manual review needed:`);
console.log(`  - Check all setup() functions`);
console.log(`  - Update methods to use store actions`);
console.log(`  - Update computed properties to use storeToRefs`);
console.log(`  - Remove old mapState/mapActions calls`);

