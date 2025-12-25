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

type View = {
  imageObserver: IntersectionObserver
  $images: HTMLElement[]
  $visibleImage: HTMLElement | null
}

const $ = (p: Document | HTMLElement, sel: string): HTMLElement | null => p.querySelector(sel)
const $main = $(document, 'main')!

const view: View = {
  imageObserver: new IntersectionObserver(onImageIsVisible, {root: $main, threshold: 0.1}),
  $images: [],
  $visibleImage: null,
}

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
  view.$images = []
  ;[].map.call($main.querySelectorAll('div.image'), (el: HTMLElement) => el.remove())

  if (images.length === 0) {
    return displayText(`No images found.`)
  }

  images.forEach((image) => {
    const $image = document.createElement('div')
    $image.dataset.src = convertFileSrc(image.path)
    $image.className = 'image'
    $image.innerText = image.path.split('/').pop() || ''
    $main.appendChild($image)
    view.$images.push($image)
    view.imageObserver.observe($image)
  })

  $main.classList.remove('empty')
  $main.classList.add('images')
}

function displayText(text: string) {
  $($main, 'p')!.textContent = text
  $main.classList.remove('images')
  $main.classList.add('empty')
}

function onImageIsVisible(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    view.$visibleImage = entry.target as HTMLElement

    const idx = view.$images.indexOf(view.$visibleImage)
    view.$images.forEach(($image, i) => {
      let $img = $image.firstElementChild as HTMLImageElement

      if (i >= idx - 2 && i <= idx + 3) {
        if (!$img) {
          $img = document.createElement('img')
          $img.alt = $image.textContent!.trim()
          $img.src = $image.dataset.src ?? ''
          $image.innerText = ''
          $image.appendChild($img)
        }
      } else if ($img) {
        $image.innerText = $img.alt
      }

      if (i === idx) {
        console.log($img)
        $($main, '.name')!.innerText = $img.alt
      }
    })

    break
  }
}
