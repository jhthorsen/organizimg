import {convertFileSrc} from '@tauri-apps/api/core'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {invoke} from '@tauri-apps/api/core'
import {message, open} from '@tauri-apps/plugin-dialog'
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
  path: string | null
  $images: HTMLElement[]
  $visibleImage: HTMLElement | null
}

const $ = (p: Document | HTMLElement, sel: string): HTMLElement | null => p.querySelector(sel)
const $main = $(document, 'main')!

const view: View = {
  imageObserver: new IntersectionObserver(onImageIsVisible, {root: $main, threshold: 0.1}),
  path: null,
  $images: [],
  $visibleImage: null,
}

window.addEventListener('keydown', onKeyDown)
$(document, 'button[name=trash]')!.addEventListener('click', trashImages)
$(document, 'button[name=open]')!.addEventListener('click', openDirectory)

function displayImages(images: File[]) {
  view.$images = []
  ;[].map.call($main.querySelectorAll('div.image'), (el: HTMLElement) => el.remove())

  if (images.length === 0) {
    return displayText('No images found.')
  }

  images.forEach((image) => {
    const $image = document.createElement('div')
    $image.dataset.path = image.path
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
        $($main, '.name')!.innerText = $img.alt
      }
    })

    break
  }
}

function onKeyDown(evt: KeyboardEvent) {
  if (evt.key === 'ArrowRight' || evt.key === 'l') {
    const idx = view.$images.indexOf(view.$visibleImage as HTMLElement)
    view.$images[idx + 1]?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'start'})
  } else if (evt.key === 'ArrowLeft' || evt.key === 'h') {
    const idx = view.$images.indexOf(view.$visibleImage as HTMLElement)
    view.$images[idx - 1]?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'start'})
  } else if ((evt.ctrlKey || evt.metaKey) && evt.key === 'o') {
    openDirectory()
  } else if (evt.key === 'o') {
    openDirectory()
  } else if (evt.key === 'Backspace' || evt.key === 'd') {
    trashImages()
  } else if (evt.key === 'ArrowDown' || evt.key === 'j') {
    view.$visibleImage?.classList.add('discard')
    toggleTrashButtonDisabled()
  } else if (evt.key === 'ArrowUp' || evt.key === 'k') {
    view.$visibleImage?.classList.remove('discard')
    toggleTrashButtonDisabled()
  } else {
    return
  }

  evt.preventDefault()
}

async function openDirectory() {
  const path = await open({
    directory: true,
    multiple: false,
    title: 'Select a directory',
  })

  view.path = path ?? ''
  $(document, '#title .path')!.textContent = `${view.path}`
  if (!path) return

  try {
    const images: File[] = await invoke('get_images', {path})
    displayImages(images)
  } catch (err) {
    displayText(`${path}: ${err}`)
  }
}

function toggleTrashButtonDisabled() {
  const $btn = $(document, 'button[name=trash]')! as HTMLButtonElement
  $btn.disabled = $main.querySelectorAll('.image.discard').length === 0
}

async function trashImages() {
  const $discard = $main.querySelectorAll<HTMLInputElement>('.image.discard')
  if ($discard.length === 0) return

  const answer = await message(`Delete ${$discard.length} images?`, {
    title: 'Confirm Deletion',
    kind: 'error',
    buttons: 'OkCancel',
  })

  if (answer.toLowerCase() !== 'ok') return

  try {
    for (const $image of $discard) {
      await invoke('trash_image', {path: $image.dataset.path})
      $image.remove()
    }
  } catch (err) {
    displayText(`${err}`)
  }

  toggleTrashButtonDisabled()
}
