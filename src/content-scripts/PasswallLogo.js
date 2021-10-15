import { getOffset } from '@/utils/helpers'
import { PASSWALL_ICON_BS64 } from '@/utils/constants'

export class PasswallLogo {
  /**
   * @type {HTMLElement} input
   */
  input
  /**
   * @type {HTMLElement}
   */
  image
  /**
   *
   * @param {HTMLElement} input
   * @param {Function} onClick
   */
  constructor(input, onClick) {
    this.input = input
    this.onClick = onClick
  }

  create() {
    this.image = document.createElement('img')

    this.image.setAttribute('id', 'passwall-input-icon')

    this.image.alt = 'Passwall'
    this.image.src = PASSWALL_ICON_BS64
    this.image.addEventListener('click', this.onClick)
  }

  update() {
    const { top, left, height, width } = getOffset(this.input)
    const SIZE = height * 0.7

    this.image.setAttribute(
      'style',
      `
      top: ${top + (height * (1 - SIZE / height)) / 2}px;
      left: ${left + width - SIZE - 5}px;
      height: ${SIZE}px;
      width: ${SIZE}px;
      z-index: 99999;
      `
    )
    document.body.appendChild(this.image)
  }

  destroy() {
    this.image.remove()
  }

  render() {
    this.create()
    this.update()
  }
}
