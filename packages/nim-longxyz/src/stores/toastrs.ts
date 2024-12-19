import { createSignal, type JSX } from 'solid-js'

type Toast = {
  content: string | JSX.Element
  level: Level
  id: number
  canClose?: boolean
  icon?: JSX.Element
}

type Level = 'success' | 'error' | 'info'

const toastrsStore = createSignal<Toast[]>([])

export const [toastrs, setToastrs] = toastrsStore

function addToastr(toast: Toast) {
  if (!toastrs().find(({ id }) => id === toast.id)) {
    setToastrs([...toastrs(), toast])
    return
  }

  setToastrs([
    ...toastrs().map(t => {
      if (toast.id === t.id) {
        return toast
      }
      return t
    }),
  ])
}

export function removeToastr(id: number) {
  setToastrs([...toastrs().filter(toarstr => toarstr.id !== id)])
}

type ToastrReturn = {
  log(toast: string | JSX.Element, icon?: JSX.Element): ToastrReturn
  error(toast: string | JSX.Element, icon?: JSX.Element): ToastrReturn
  success(toast: string | JSX.Element, icon?: JSX.Element): ToastrReturn
}

export type Toastr = (props?: Partial<Props>) => ToastrReturn

type Props = { canClose: boolean }

export function toastr(props?: Partial<Props>): Toastr {
  const id = new Date().getTime()

  return p => ({
    log(toast: string | JSX.Element, icon?: JSX.Element) {
      addToastr({
        content: toast,
        level: 'info',
        id,
        canClose: p?.canClose || props?.canClose,
        icon,
      })
      return this
    },
    error(toast: string | JSX.Element, icon?: JSX.Element) {
      addToastr({
        content: toast,
        level: 'error',
        id,
        canClose: p?.canClose || props?.canClose,
        icon,
      })
      return this
    },
    success(toast: string | JSX.Element, icon?: JSX.Element) {
      addToastr({
        content: toast,
        level: 'success',
        id,
        canClose: p?.canClose || props?.canClose,
        icon,
      })
      return this
    },
  })
}
