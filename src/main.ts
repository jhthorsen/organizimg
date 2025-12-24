import {convertFileSrc} from '@tauri-apps/api/core'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {invoke} from '@tauri-apps/api/core'
import {open} from '@tauri-apps/plugin-dialog'
import {restoreStateCurrent, saveWindowState, StateFlags} from '@tauri-apps/plugin-window-state'

restoreStateCurrent(StateFlags.ALL)
getCurrentWindow().onCloseRequested(() => saveWindowState(StateFlags.ALL))
getCurrentWindow().onMoved(() => saveWindowState(StateFlags.ALL))

type File = {
  path: string
  size: number
}

const $ = (p: Document | Element |HTMLElement, sel: string) => p.querySelector(sel)
const $main = $(document, 'main')!

$(document, 'a[href$="#delete"]')!.addEventListener(
  'click',
  async () => {
  },
)

$(document, 'a[href$="#open"]')!.addEventListener(
  'click',
  async () => {
    const path = await open({
      directory: true,
      multiple: false,
      title: 'Select a directory',
    })

    $(document, '#title .path')!.textContent = `${path}`
    if (!path) return

    try {
      const images: File[] = await invoke('get_images', {path})
      displayImages(images)
    } catch (error) {
      displayText(`${path}: ${error}`)
    }
  },
)

function displayImages(images: File[]) {
  ;[].map.call($main.querySelectorAll('div.image'), (el: HTMLElement) => el.remove())

  if (images.length === 0) {
    return displayText(`No images found.`)
  }

  images.forEach((image) => {
    const $img = document.createElement('img')
    $img.src = convertFileSrc(image.path)
    $img.alt = image.path
    $img.title = image.path

    const $wrapper = document.createElement('div')
    $wrapper.className = 'image'
    $wrapper.appendChild($img)
    $main.appendChild($wrapper)
  })

  $main.classList.remove('empty')
  $main.classList.add('images')
}

function displayText(text: string) {
  $($main, 'p')!.textContent = text
  $main.classList.remove('images')
  $main.classList.add('empty')
}
