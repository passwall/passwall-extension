const puppeteer = require('puppeteer')
const path = require('path')

// Path to the actual extension we want to be testing
const pathToExtension = path.join(path.join(__dirname, '..', '..', 'dist'))
const ssPath = path.join(__dirname, 'ss')

const puppeteerArgs = [
  `--disable-extensions-except=${pathToExtension}`,
  `--load-extension=${pathToExtension}`,
  '--show-component-extension-options'
]

describe('Popup page', () => {
  let page, browser

  beforeAll(async () => {
    jest.setTimeout(10000)
    const extensionId = 'odglpdofikjpafligcbgbfjafilpknko'
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

    await page.reload()
  })

  afterAll(async () => {
    // Tear down the browser
    await browser.close()
  })

  it('Login Fail', async () => {
    await page.waitForSelector('[data-testid="username"]')

    await Promise.all([
      await page.type('[data-testid="username"] > input', 'ooruc471@yandex.com', { delay: 0 }),
      await page.type('[data-testid="password"] > input', 'fakepassword', { delay: 0 })
    ])

    await page.$eval('button[type="submit"]', el => el.click())
    await page.waitForSelector('.vue-notification')
    const errorText = await page.$eval('.vue-notification', el => el.innerText)

    await page.screenshot({ path: path.join(ssPath, 'login-fail.png') })

    expect(errorText).toEqual('User email or master password is wrong.')
  })
})
