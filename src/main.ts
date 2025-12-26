import {convertFileSrc} from '@tauri-apps/api/core'
import {getCurrentWindow} from '@tauri-apps/api/window'
import {invoke} from '@tauri-apps/api/core'
import {message, open} from '@tauri-apps/plugin-dialog'
import {platform} from '@tauri-apps/plugin-os'
import {restoreStateCurrent, saveWindowState, StateFlags} from '@tauri-apps/plugin-window-state'

function saveWindowStateWrapper(_evt: any) {
  if (saveWindowStateWrapper.tid) return
  saveWindowStateWrapper.tid = setTimeout(() => {
    saveWindowState(StateFlags.ALL)
    saveWindowStateWrapper.tid = 0
  }, 100)
}

saveWindowStateWrapper.tid = 0

restoreStateCurrent(StateFlags.ALL)
getCurrentWindow().onMoved(saveWindowStateWrapper)
getCurrentWindow().onResized(saveWindowStateWrapper)

type File = {
  path: string
  size: number
}

const $ = (p: Document | HTMLElement, sel: string): HTMLElement | null => p.querySelector(sel)

class Organizeimg {
  $root: HTMLElement
  $visibleImage: HTMLElement | null
  imageObserver: IntersectionObserver

  constructor($root: HTMLElement) {
    this.$root = $root
    this.$visibleImage = null
    this.imageObserver = new IntersectionObserver(this._onImageIntersectChange.bind(this), {
      root: $root,
      threshold: 0.1,
    })
  }

  displayImages(images: File[]) {
    ;[].map.call(this.$root.querySelectorAll('div.image'), (el: HTMLElement) => el.remove())

    if (images.length === 0) {
      return this.displayMessage('No images found in selected directory.')
    }

    images.forEach((image) => {
      const $image = document.createElement('div')
      $image.className = 'image'
      $image.innerText = image.path.split('/').pop() || ''
      $image.dataset.path = image.path
      $image.dataset.src = convertFileSrc(image.path)
      this.$root.appendChild($image)
      this.imageObserver.observe($image)
    })

    this.$root.scrollTo(0, 0)
    this.setView('images')
  }

  displayMessage(message: string) {
    $(this.$root, 'p')!.textContent = message
    this.setView('empty')
  }

  findAllImages(sel = '.image') {
    return Array.from(this.$root.querySelectorAll<HTMLElement>(sel))
  }

  isView(className: string) {
    return this.$root.classList.contains(className)
  }

  async openDirectory(path: string | null) {
    if (path === null) {
      path = await open({
        directory: true,
        multiple: false,
        title: 'Select a directory',
      }) ?? ''
    }

    $(document, '#title .path')!.textContent = `${path ?? ''}`

    if (path.length > 0) {
      try {
        this.displayMessage(`${path}`)
        this.displayImages(await invoke('get_images', {path}))
      } catch (err) {
        this.displayMessage(`${path}: ${err}`)
      }
    }
  }

  setView(className: string, alternative: string | null = null) {
    const cl = this.$root.classList
    for (const view of ['discarded', 'empty', 'help', 'images']) {
      if (className !== view) cl.remove(view)
    }

    if (cl.contains(className) && alternative !== null) {
      cl.remove(className)
      cl.add(alternative)
    } else {
      cl.add(className)
    }
  }

  showImage(idx: number | string) {
    const options: ScrollIntoViewOptions = {block: 'nearest', inline: 'start'}
    switch (idx) {
      case 'previous':
        options.behavior = 'smooth'
        idx = this.findAllImages().indexOf(this.$visibleImage as HTMLElement) - 1
        break
      case 'next':
        options.behavior = 'smooth'
        idx = this.findAllImages().indexOf(this.$visibleImage as HTMLElement) + 1
        break
      default:
        idx = idx as number
    }

    const $images = this.findAllImages()
    if (idx < 0) idx = $images.length - 1
    if (idx >= $images.length) idx = 0
    this.$visibleImage = $images[idx]
    this.$visibleImage?.scrollIntoView(options)
  }

  async trashImages() {
    const $discarded = this.findAllImages('.image.discard')
    if ($discarded.length === 0) return

    const answer = await message(`Delete ${$discarded.length} images?`, {
      title: 'Confirm Deletion',
      kind: 'error',
      buttons: 'OkCancel',
    })

    if (answer.toLowerCase() === 'ok') {
      try {
        for (const $image of $discarded) {
          await invoke('trash_image', {path: $image.dataset.path})
          $image.remove()
        }
      } catch (err) {
        this.displayMessage(`${err}`)
      }
    }

    this._toggleTrashButtonDisabled()
  }

  _onImageIntersectChange(entries: IntersectionObserverEntry[]) {
    if (!this.isView('images')) return

    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      this.$visibleImage = entry.target as HTMLElement

      const $images = this.findAllImages()
      const idx = $images.indexOf(this.$visibleImage)
      $images.forEach(($image, i) => {
        let $img = $image.firstElementChild as HTMLImageElement

        if (i >= idx - 2 && i <= idx + 3) {
          $img = this._displayImage($image)
        } else if ($img) {
          $image.innerText = $img.alt
        }

        if (i === idx) {
          $(this.$root, '.name')!.innerText = $img.alt
        }
      })

      break
    }
  }

  _displayImage($image: HTMLElement) {
    console.log($image)
    let $img = $image.firstElementChild as HTMLImageElement
    if ($img && $img.tagName === 'IMG') return $img

    $img = document.createElement('img')
    $img.alt = $image.textContent!.trim()
    $img.src = $image.dataset.src ?? ''

    $img.addEventListener('click', () => {
      this.setView('images')
      this.showImage(this.findAllImages().indexOf($img.parentNode as HTMLElement))
    })

    $image.innerText = ''
    $image.appendChild($img)
    return $img
  }

  _onKeyDown(evt: KeyboardEvent) {
    if (this.isView('images')) {
      if (evt.key === 'ArrowRight' || evt.key === 'l') {
        this.showImage('next')
        evt.preventDefault()
      } else if (evt.key === 'ArrowLeft' || evt.key === 'h') {
        this.showImage('previous')
        evt.preventDefault()
      } else if (evt.key === 'Backspace' || evt.key === 'd') {
        this.$visibleImage?.classList.toggle('discard')
        this._toggleTrashButtonDisabled()
        evt.preventDefault()
      }
    }

    if (((evt.ctrlKey || evt.metaKey) && evt.key === 'o') || evt.key === 'o') {
      this.openDirectory(null)
      evt.preventDefault()
    } else if ((evt.ctrlKey || evt.metaKey) && evt.key === 'Backspace') {
      this.trashImages()
      evt.preventDefault()
    } else if (evt.key === '?') {
      this.$root.classList.toggle('help')
    } else if (evt.key === 'z') {
      const n = this.findAllImages('.image.discard').map(($image) =>
        this._displayImage($image)
      ).length
      this.setView(n > 0 ? 'discarded' : 'images', 'images')
    }
  }

  _toggleTrashButtonDisabled() {
    const $btn = $(document, 'button[name=trash]')! as HTMLButtonElement
    $btn.disabled = this.findAllImages('.image.discard').length === 0
  }
}

const organizeimg = new Organizeimg($(document, 'main')!)
window.addEventListener('keydown', (evt) => organizeimg._onKeyDown(evt))
$(document, 'button[name=trash]')!.addEventListener('click', () => organizeimg.trashImages())
$(document, 'button[name=open]')!.addEventListener('click', () => organizeimg.openDirectory(null))
;[].map.call(document.querySelectorAll('[hidden*="macos"]'), (el: HTMLElement) => {
  if (el.getAttribute('hidden') === platform()) {
    el.remove()
  } else {
    el.removeAttribute('hidden')
  }
})
