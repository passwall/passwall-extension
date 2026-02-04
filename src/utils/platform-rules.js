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
 * Equivalent Domains
 *
 * Some services use multiple domains that should share credentials.
 * Example: Google accounts work on google.com, youtube.com, gmail.com, etc.
 *
 * @type {Map<string, Set<string>>}
 */
export const EQUIVALENT_DOMAINS = new Map([
  // Google services
  [
    'google.com',
    new Set(['google.com', 'youtube.com', 'gmail.com', 'google.co.uk', 'google.com.tr'])
  ],

  // Microsoft services
  [
    'microsoft.com',
    new Set(['microsoft.com', 'live.com', 'outlook.com', 'hotmail.com', 'msn.com', 'office.com'])
  ],

  // Apple services
  ['apple.com', new Set(['apple.com', 'icloud.com', 'me.com', 'mac.com'])],

  // Amazon services
  ['amazon.com', new Set(['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.com.tr'])]
])

/**
 * Domain Match Blacklist
 *
 * For certain base domains, exclude specific subdomains from credential matching.
 * This prevents false positives where a subdomain shouldn't use the main domain's credentials.
 *
 * Example: google.com credentials shouldn't autofill on script.google.com
 *
 * @type {Map<string, Set<string>>}
 */
export const DOMAIN_MATCH_BLACKLIST = new Map([
  // Google: Exclude API/developer subdomains
  [
    'google.com',
    new Set([
      'script.google.com', // Google Apps Script
      'developers.google.com', // Developer console
      'console.cloud.google.com' // Google Cloud (different auth)
    ])
  ],

  // Amazon: Exclude seller/AWS subdomains
  [
    'amazon.com',
    new Set([
      'sellercentral.amazon.com', // Seller Central (different auth)
      'advertising.amazon.com' // Amazon Ads (different auth)
    ])
  ],

  // Microsoft: Exclude developer portals
  [
    'microsoft.com',
    new Set([
      'dev.azure.com', // Azure DevOps (different auth)
      'developer.microsoft.com' // Developer portal
    ])
  ],

  // GitHub: Exclude GitHub Pages
  [
    'github.com',
    new Set([
      'pages.github.com' // GitHub Pages (static hosting)
    ])
  ]
])

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
      patterns: [/account.?id/i, /aws.?account/i, /12.?digit/i]
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
      patterns: [/organization.?id/i, /tenant.?id/i, /org.?id/i]
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
      patterns: [/org(?:anization)?.?id/i]
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
      patterns: [/company.?id/i, /workspace.?domain/i]
    }
  },
  {
    name: 'Passwall Vault',
    domains: ['vault.passwall.io'],
    description: 'Vault UI fields should not trigger credential capture',
    loginSteps: 1,
    excludeFields: {
      names: ['pin'],
      ids: ['pin'],
      labels: ['pin'],
      patterns: [/pin/i]
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
  const rule = PLATFORM_RULES.find((platformRule) =>
    platformRule.domains.some((domain) => normalizedHostname.includes(domain.toLowerCase()))
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
  if (excludeFields.names && excludeFields.names.some((name) => inputName === name.toLowerCase())) {
    return true
  }

  // 2. Check field IDs
  if (excludeFields.ids && excludeFields.ids.some((id) => inputId === id.toLowerCase())) {
    return true
  }

  // 3. Check label text (partial match)
  if (
    excludeFields.labels &&
    labelText &&
    excludeFields.labels.some((label) => labelText.includes(label.toLowerCase()))
  ) {
    return true
  }

  // 4. Check regex patterns
  if (
    excludeFields.patterns &&
    excludeFields.patterns.some((pattern) => {
      const allText = [inputName, inputId, labelText].join(' ')
      return pattern.test(allText)
    })
  ) {
    return true
  }

  return false
}

/**
 * Check if a field should be ignored for detection or capture
 * (platform rules + opt-out attributes)
 *
 * @param {HTMLInputElement} input - Input element to check
 * @param {string} hostname - Current page hostname
 * @param {Object} [options]
 * @param {boolean} [options.respectAutocompleteOff=true] - Respect autocomplete="off"
 * @returns {boolean}
 */
export function shouldIgnoreField(input, hostname, options = {}) {
  if (!input) return false

  const respectAutocompleteOff = options.respectAutocompleteOff !== false
  const autocomplete = (input.getAttribute('autocomplete') || '').toLowerCase()

  const hasLpIgnore =
    input.hasAttribute('data-lpignore') ||
    input.hasAttribute('data-lp-ignore') ||
    input.hasAttribute('lpignore')

  const hasPasswallIgnore = input.hasAttribute('data-passwall-ignore')

  if (hasPasswallIgnore || hasLpIgnore) {
    return true
  }

  if (respectAutocompleteOff && (autocomplete === 'off' || autocomplete === 'false')) {
    return true
  }

  return shouldExcludeField(input, hostname)
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

/**
 * Get equivalent domains for a given domain
 *
 * @param {string} domain - Base domain (e.g., 'google.com')
 * @returns {Set<string>} Set of equivalent domains
 *
 * @example
 * getEquivalentDomains('google.com')
 * // Returns: Set(['google.com', 'youtube.com', 'gmail.com', ...])
 *
 * getEquivalentDomains('youtube.com')
 * // Returns: Set(['google.com', 'youtube.com', 'gmail.com', ...]) (same group!)
 */
export function getEquivalentDomains(domain) {
  if (!domain) return new Set([])

  const normalizedDomain = domain.toLowerCase()

  // Check if this domain is in any equivalent domain group
  for (const [key, equivalents] of EQUIVALENT_DOMAINS.entries()) {
    if (equivalents.has(normalizedDomain)) {
      return equivalents // Return the entire group
    }
  }

  // No equivalent domains - return just this domain
  return new Set([normalizedDomain])
}

/**
 * Check if a hostname should be excluded from domain matching
 * Checks if a hostname should be excluded from domain matching
 *
 * @param {string} hostname - Full hostname to check (e.g., 'script.google.com')
 * @param {string} baseDomain - Base domain (e.g., 'google.com')
 * @returns {boolean} True if hostname should be excluded
 *
 * @example
 * isHostnameBlacklisted('script.google.com', 'google.com')
 * // Returns: true (blacklisted!)
 *
 * isHostnameBlacklisted('mail.google.com', 'google.com')
 * // Returns: false (allowed)
 */
export function isHostnameBlacklisted(hostname, baseDomain) {
  if (!hostname || !baseDomain) return false

  const normalizedHostname = hostname.toLowerCase()
  const normalizedDomain = baseDomain.toLowerCase()

  // Check if this base domain has blacklist entries
  const blacklistedSubdomains = DOMAIN_MATCH_BLACKLIST.get(normalizedDomain)

  if (!blacklistedSubdomains) {
    return false // No blacklist for this domain
  }

  // Check if current hostname is in the blacklist
  return blacklistedSubdomains.has(normalizedHostname)
}

export default {
  PLATFORM_RULES,
  EQUIVALENT_DOMAINS,
  DOMAIN_MATCH_BLACKLIST,
  getPlatformRules,
  shouldExcludeField,
  shouldIgnoreField,
  getPlatformInfo,
  addPlatformRule,
  getEquivalentDomains,
  isHostnameBlacklisted
}
