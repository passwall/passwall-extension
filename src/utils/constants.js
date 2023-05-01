export const TABS = [
  {
    name: 'Login',
    iconName: 'lock',
    createRouteName: 'LoginCreate'
  },
  {
    name: 'Credit Cards',
    iconName: 'credit-card',
    createRouteName: 'CreditCardCreate'
  },
  {
    name: 'Emails',
    iconName: 'at-symbol',
    createRouteName: 'EmailCreate'
  },
  {
    name: 'Bank Accounts',
    iconName: 'shield-check',
    createRouteName: 'BankAccountCreate'
  },
  {
    name: 'Private Notes',
    iconName: 'clipboard-secure',
    createRouteName: 'NoteCreate'
  },
  {
    name: 'Servers',
    iconName: 'terminal',
    createRouteName: 'ServerCreate'
  }
]

export const BROWSER_URL_PATTERNS = [/^chrome:\/\/.*/, /about:.*/]
export const PASSWALL_ICON_BS64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAALnSURBVHgBzVc/aBNRGP+9K00qGYyDc9Kp4GBaENysLkIXieCfIEjaQaFgtQ6Cg2gVB8ElIUJBB6MuLThEBQsuWjeh0NpBcPI6O5gO0aTSPL/vvdzlcr1cziQX+oPj3t378/3/3vcJBEQ6LuMjFaTlECalxLiQSEIgriYlylLApH8bNPdpJ4Y3pbIoBzlXdFqQGZFJOnSeiGRtgkEgURQG7i9VhYluGGCJo39wj4bz6AV15Jb/ipv4HwYaUn+kYRL9gSkETnlpw3D/uDQsx/tMnKEEOk9nuydaNBCC5G7s0YTNQMPm6yESt5moHcCEFSW2CRoOl0T4SEYripaC0kBD9T8wQJApRtkUWgN1LGDA2JU6vEUaZPsofnktilHamboGHDkBHE4AP7eArU3gfUGPe0SZfGFUZIbltDTw3D177Aww+1Qz4UaF3GfxKrD2Fj2hXseMyERkkfJ41jnB0ha+dz5g5Ylmxg+rr3y0xen6QkSuk0O0JIhHX8hVU3rMBH5va6a6ARN/cLoNE3R5GcIVekzIIs6bbh8H5sb0043d+by7H9oIIJA03DdcItUcrxS0Ay5V9QGvH6Ir8N7ZZ55T8T13Qexg6zdLbX5FaDC4mHD++Pa5OZ6aa5qB3+fu+B/mdEjnmPcuXvHcUjYkCej8w4stJqxo4Icd088R2TwWoxwd18e05sxNXyc0OQqKwhWGiaPacWId6h9Lqsp2MyfwHqf0VgLzBIehXyLKPvaWmgm8vKVjvBdQ/pnWqThCF5FHvcfEJy83UzETXnsXLAEFAaXiQ+o2vBiVOXrdwCBB6l/eETMqDMkHchgwuGLmt2KgUSLlMTjkrbLMTkS1mqoJTIQPLskWrA+bgRJEmQvGkJlQRamza2pJxayWoTrOhsSEOtvdG+y/xoTBC8knJtAfx8xzGd6uRwzUnHLR6q6afMEXnMALDu+um1M3VHteRZqYOVkHUqqQcbbnrGYDG2IXq9UYSkHb839uxjO+GPt5owAAAABJRU5ErkJggg=='

/**
 * @enum {string}
 */
export const EVENT_TYPES = {
  TAB_UPDATE: 'TAB_UPDATE',
  REQUEST_LOGINS: 'REQUEST_LOGINS',
  REFRESH_TOKENS: 'REFRESH_TOKENS',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT'
}
