/**
 * Platform-Specific Rules for Form Detection
 * 
 * This module provides site-specific configurations for handling edge cases
 * in form detection and autofill behavior across different platforms.
 * 
 * @module platform-rules
 */

/**
 * @typedef {Object} FieldExclusionRule
 * @property {string[]} names - Field name patterns to exclude
 * @property {string[]} ids - Field ID patterns to exclude
 * @property {string[]} labels - Label text patterns to exclude
 * @property {RegExp[]} patterns - General regex patterns to match
 */

/**
 * @typedef {Object} PlatformRule
 * @property {string[]} domains - List of domains this rule applies to
 * @property {string} name - Platform name (for logging)
 * @property {FieldExclusionRule} excludeFields - Fields to exclude from detection/fill
 * @property {number} [loginSteps] - Number of steps in login flow
 * @property {string} [description] - Description of the platform's login behavior
 */

/**
 * Platform-specific rules database
 * Add new platforms here as edge cases are discovered
 * 
 * @type {PlatformRule[]}
 */
export const PLATFORM_RULES = [
  {
    name: 'AWS (Amazon Web Services)',
    domains: ['signin.aws.amazon.com', 'console.aws.amazon.com'],
    description: '3-step login: Account ID → IAM Username → Password',
    loginSteps: 3,
    excludeFields: {
      names: ['account'],
      ids: ['account'],
      labels: ['account id', 'account id or alias'],
      patterns: [
        /account.?id/i,
        /aws.?account/i,
        /12.?digit/i
      ]
    }
  },
  {
    name: 'Microsoft Azure',
    domains: ['login.microsoftonline.com', 'portal.azure.com'],
    description: 'Multi-step login with organization/tenant ID',
    loginSteps: 2,
    excludeFields: {
      names: ['organization', 'tenant', 'orgid', 'tenantid'],
      ids: ['organization', 'tenant', 'orgId', 'tenantId'],
      labels: ['organization id', 'tenant id', 'org id'],
      patterns: [
        /organization.?id/i,
        /tenant.?id/i,
        /org.?id/i
      ]
    }
  },
  {
    name: 'Salesforce',
    domains: ['login.salesforce.com'],
    description: 'Multi-step login with organization ID',
    loginSteps: 2,
    excludeFields: {
      names: ['orgid', 'org'],
      ids: ['orgId', 'org-id'],
      labels: ['organization id', 'org id'],
      patterns: [
        /org(?:anization)?.?id/i
      ]
    }
  },
  {
    name: 'Google Workspace',
    domains: ['accounts.google.com'],
    description: 'Multi-step with optional company/domain ID',
    loginSteps: 2,
    excludeFields: {
      names: ['company', 'domain'],
      ids: ['company-id', 'domain-id'],
      labels: ['company id', 'domain'],
      patterns: [
        /company.?id/i,
        /workspace.?domain/i
      ]
    }
  }
]

/**
 * Get platform rules for a given domain
 * 
 * @param {string} hostname - Current page hostname (e.g., 'signin.aws.amazon.com')
 * @returns {PlatformRule|null} Matching platform rule or null
 * 
 * @example
 * const rules = getPlatformRules('signin.aws.amazon.com')
 * // Returns AWS platform rule
 */
export function getPlatformRules(hostname) {
  if (!hostname) return null
  
  const normalizedHostname = hostname.toLowerCase()
  
  // Find matching platform rule
  const rule = PLATFORM_RULES.find(platformRule => 
    platformRule.domains.some(domain => 
      normalizedHostname.includes(domain.toLowerCase())
    )
  )
  
  return rule || null
}

/**
 * Check if a field should be excluded based on platform rules
 * 
 * @param {HTMLInputElement} input - Input element to check
 * @param {string} hostname - Current page hostname
 * @returns {boolean} True if field should be excluded
 * 
 * @example
 * if (shouldExcludeField(inputElement, 'signin.aws.amazon.com')) {
 *   // Skip this field
 * }
 */
export function shouldExcludeField(input, hostname) {
  const platformRule = getPlatformRules(hostname)
  if (!platformRule || !platformRule.excludeFields) {
    return false
  }
  
  const { excludeFields } = platformRule
  const inputName = (input.name || '').toLowerCase()
  const inputId = (input.id || '').toLowerCase()
  
  // Get label text
  let labelText = ''
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`)
    labelText = label ? (label.textContent || '').toLowerCase() : ''
  }
  if (!labelText) {
    const parentLabel = input.closest('label')
    labelText = parentLabel ? (parentLabel.textContent || '').toLowerCase() : ''
  }
  
  // Check against exclusion rules
  
  // 1. Check field names
  if (excludeFields.names && excludeFields.names.some(name => 
    inputName === name.toLowerCase()
  )) {
    return true
  }
  
  // 2. Check field IDs
  if (excludeFields.ids && excludeFields.ids.some(id => 
    inputId === id.toLowerCase()
  )) {
    return true
  }
  
  // 3. Check label text (partial match)
  if (excludeFields.labels && labelText && excludeFields.labels.some(label => 
    labelText.includes(label.toLowerCase())
  )) {
    return true
  }
  
  // 4. Check regex patterns
  if (excludeFields.patterns && excludeFields.patterns.some(pattern => {
    const allText = [inputName, inputId, labelText].join(' ')
    return pattern.test(allText)
  })) {
    return true
  }
  
  return false
}

/**
 * Get platform-specific configuration for logging/debugging
 * 
 * @param {string} hostname - Current page hostname
 * @returns {Object} Platform configuration object
 */
export function getPlatformInfo(hostname) {
  const rule = getPlatformRules(hostname)
  
  if (!rule) {
    return {
      hasPlatformRules: false,
      platform: 'Generic',
      description: 'No platform-specific rules'
    }
  }
  
  return {
    hasPlatformRules: true,
    platform: rule.name,
    description: rule.description,
    loginSteps: rule.loginSteps,
    excludedFieldCount: [
      ...(rule.excludeFields.names || []),
      ...(rule.excludeFields.ids || []),
      ...(rule.excludeFields.labels || [])
    ].length
  }
}

/**
 * Add a new platform rule dynamically (for testing or extension)
 * 
 * @param {PlatformRule} rule - New platform rule to add
 * 
 * @example
 * addPlatformRule({
 *   name: 'Custom Platform',
 *   domains: ['login.example.com'],
 *   excludeFields: {
 *     names: ['company-id'],
 *     patterns: [/company/i]
 *   }
 * })
 */
export function addPlatformRule(rule) {
  if (!rule || !rule.domains || !rule.name) {
    throw new Error('Invalid platform rule: must have name and domains')
  }
  
  PLATFORM_RULES.push(rule)
}

export default {
  PLATFORM_RULES,
  getPlatformRules,
  shouldExcludeField,
  getPlatformInfo,
  addPlatformRule
}

