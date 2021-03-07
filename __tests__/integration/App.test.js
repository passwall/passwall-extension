const puppeteer = require('puppeteer')
const path = require('path')

// Path to the actual extension we want to be testing
const pathToExtension = path.join(path.join(__dirname, '..', '..', 'dist'))
const ssPath = path.join(__dirname, 'ss')

const puppeteerArgs = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  `--disable-extensions-except=${pathToExtension}`,
  `--load-extension=${pathToExtension}`,
  '--show-component-extension-options'
]

const getTestId = id => {
  return `[data-testid='${id}']`
}

describe('Popup page', () => {
  let page, browser
  const usernameField = '[data-testid="username"] > input'
  const passwordField = '[data-testid="password"] > input'

  beforeAll(async () => {
    jest.setTimeout(10000)
    const extensionId = 'jabeoiimmbndiolpljnmijcppnphdigl'
    const chromeExtPath = `chrome-extension://${extensionId}/popup.html`
    browser = await puppeteer.launch({
      headless: false,
      slowMo: 1,
      devtools: true,
      args: puppeteerArgs
    })

    // Creates a new tab
    page = await browser.newPage()

    await page.goto(chromeExtPath, { waitUntil: 'domcontentloaded' })
  })

  beforeEach(async () => {
    await page.reload()
  })

  afterAll(async () => {
    // Tear down the browser
    await browser.close()
  })

  it('Login Fail', async () => {
    await page.waitForSelector(usernameField)

    await Promise.all([
      await page.type(usernameField, 'ooruc471@yandex.com', { delay: 0 }),
      await page.type(passwordField, 'fakepassword', { delay: 0 })
    ])

    await page.$eval('button[type="submit"]', el => el.click())
    await page.waitForSelector('.vue-notification')
    const errorText = await page.$eval('.vue-notification', el => el.innerText)

    await page.screenshot({ path: path.join(ssPath, 'login-fail.png') })

    expect(errorText).toEqual('User email or master password is wrong.')
  })

  it('Login Success', async () => {
    const usernameLabel = '[data-testid="username-label"]'

    await page.waitForSelector(usernameField)

    await Promise.all([
      await page.type(usernameField, 'yakuter@gmail.com', { delay: 0 }),
      await page.type(passwordField, 'dell3625', { delay: 0 })
    ])

    await page.$eval('button[type="submit"]', el => el.click())

    await page.waitForSelector(usernameLabel)
    const labelText = await page.$eval(usernameLabel, el => el.innerText)
    const userObj = await page.evaluate(async () => {
      const $vm = document.querySelector('body > div').__vue__
      const storage = $vm.$storage
      return storage.getItem('user')
    })
    await page.screenshot({ path: path.join(ssPath, 'home.png') })

    expect(labelText).toEqual('Erhan Yakut')
    expect(userObj.name).toEqual('Erhan Yakut')
  })

  it('Search "Docker"', async () => {
    const searchField = "[data-testid='searchbar'] > input"
    const searchResult = "[data-testid='result']"
    await page.waitForSelector(searchField)
    await page.type(searchField, 'docker', { delay: 0 })

    await page.waitForSelector(searchResult)
    const t = await page.$eval(searchResult, el => el.children.length)

    await page.screenshot({ path: path.join(ssPath, 'search.png') })
    expect(t).toBeGreaterThanOrEqual(1)
  })

  it('Log out', async () => {
    const header = getTestId('settings-click')
    const logoutBtn = getTestId('logout-btn')

    await page.waitForSelector(header)
    await page.$eval(header, el => el.click())
    await page.waitForSelector(logoutBtn)
    await page.$eval(logoutBtn, el => el.click())

    const userObj = await page.evaluate(async () => {
      const $vm = document.querySelector('body > div').__vue__
      const storage = $vm.$storage
      return storage.getItem('user')
    })
    await page.screenshot({ path: path.join(ssPath, 'logout.png') })
    expect(userObj).toBeNull()
  })
})
