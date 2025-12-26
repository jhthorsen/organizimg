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

    this.$root.classList.remove('empty')
    this.$root.classList.add('images')
  }

  displayMessage(message: string) {
    $(this.$root, 'p')!.textContent = message
    this.$root.classList.remove('images')
    this.$root.classList.add('empty')
  }

  findAllImages() {
    return Array.from(this.$root.querySelectorAll<HTMLElement>('.image'))
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
        this.displayImages(await invoke('get_images', {path}))
      } catch (err) {
        this.displayMessage(`${path}: ${err}`)
      }
    }
  }

  showImage(idx: number | string) {
    switch (idx) {
      case 'previous':
        idx = this.findAllImages().indexOf(this.$visibleImage as HTMLElement) - 1
        break
      case 'next':
        idx = this.findAllImages().indexOf(this.$visibleImage as HTMLElement) + 1
        break
      default:
        idx = idx as number
    }

    const $images = this.findAllImages()
    if (idx < 0) idx = $images.length - 1
    if (idx >= $images.length) idx = 0
    this.$visibleImage = $images[idx]
    this.$visibleImage?.scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'start'})
  }

  async trashImages() {
    const $discard = this.$root.querySelectorAll<HTMLInputElement>('.image.discard')
    if ($discard.length === 0) return

    const answer = await message(`Delete ${$discard.length} images?`, {
      title: 'Confirm Deletion',
      kind: 'error',
      buttons: 'OkCancel',
    })

    if (answer.toLowerCase() === 'ok') {
      try {
        for (const $image of $discard) {
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
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      this.$visibleImage = entry.target as HTMLElement

      const $images = this.findAllImages()
      const idx = $images.indexOf(this.$visibleImage)
      $images.forEach(($image, i) => {
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
          $(this.$root, '.name')!.innerText = $img.alt
        }
      })

      break
    }
  }

  _onKeyDown(evt: KeyboardEvent) {
    if (evt.key === 'ArrowRight' || evt.key === 'l') {
      evt.preventDefault()
      this.showImage('next')
    } else if (evt.key === 'ArrowLeft' || evt.key === 'h') {
      evt.preventDefault()
      this.showImage('previous')
    } else if ((evt.ctrlKey || evt.metaKey) && evt.key === 'o') {
      evt.preventDefault()
      this.openDirectory(null)
    } else if (evt.key === 'o') {
      evt.preventDefault()
      this.openDirectory(null)
    } else if (evt.key === 'Backspace' || evt.key === 'd') {
      evt.preventDefault()
      this.trashImages()
    } else if (evt.key === 'ArrowDown' || evt.key === 'j') {
      evt.preventDefault()
      this.$visibleImage?.classList.add('discard')
      this._toggleTrashButtonDisabled()
    } else if (evt.key === 'ArrowUp' || evt.key === 'k') {
      evt.preventDefault()
      this.$visibleImage?.classList.remove('discard')
      this._toggleTrashButtonDisabled()
    }
  }

  _toggleTrashButtonDisabled() {
    const $btn = $(document, 'button[name=trash]')! as HTMLButtonElement
    $btn.disabled = this.$root.querySelectorAll('.image.discard').length === 0
  }
}

const organizeimg = new Organizeimg($(document, 'main')!)
window.addEventListener('keydown', (evt) => organizeimg._onKeyDown(evt))
$(document, 'button[name=trash]')!.addEventListener('click', () => organizeimg.trashImages())
$(document, 'button[name=open]')!.addEventListener('click', () => organizeimg.openDirectory(null))
