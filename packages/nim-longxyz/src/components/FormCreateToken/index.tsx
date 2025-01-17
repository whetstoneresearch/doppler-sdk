/** @jsxImportSource solid-js */
import './FormCreateToken.styles.css'
import DialogError from '../DialogError'
import type { ParentProps } from 'solid-js'
import type { TokenFields } from './FormCreateToken.service'
import { setState, state, validate } from './FormCreateToken.service'
import createToken from '~/rpc/create-token'
import { toastr } from '~/stores/toastrs'
import { isAuth, login } from '~/stores/user'
import { dialogError } from '~/stores/dialogs'
import { IconCheck, IconExclamation, IconLoading } from './icons'
import { navigate } from 'astro:transitions/client'
import type { ReadContract } from '@delvtech/drift'

export * from './FormCreateToken.service'

export default function ({ children, ...props }: ParentProps) {
  const toast = toastr({ canClose: false })

  async function requestToken(token: TokenFields) {
    return new Promise(resolve => {
      // toast begining
      toast().log('Setting up the token (1/3)', <IconLoading />)

      // request API
      // await fetch(...)

      setTimeout(() => {
        resolve(void 0)
      }, 1_5000)
    })
  }

  async function deployToken(token: TokenFields): Promise<ReadContract<any>> {
    return new Promise((resolve, reject) =>
      createToken(token)
        // setup and deploy
        .on('deploying', () => {
          toast().log('Deploying the token... (2/3)', <IconLoading />)
        })
        // success
        .on('success', contract => {
          toast().success('Token deployed! (3/3)', <IconCheck />)
          resolve(contract)
        })
        // failure
        .on('error', error => {
          toast({ canClose: true }).error(
            'Token not deployed',
            <IconExclamation />
          )
          reject(error)
        })
        .deploy()
    )
  }

  return (
    <form
      {...props}
      id="form-create"
      aria-busy={state.busy}
      inert={state.busy}
      onSubmit={async e => {
        e.preventDefault()

        if (!validate()) {
          return
        }

        setState('busy', true)

        // connect wallet if needed
        if (!isAuth()) {
          try {
            await login()
          } catch (error) {
            toast().error(`Couldn't connect wallet, try again`)
            setState('busy', false)
            return
          }
        }

        // deploy the token
        try {
          await requestToken(state)
          const token = await deployToken(state)

          // give users sometime to read
          // @todo use icon/animation
          setTimeout(() => navigate(`/tokens/${token.address}`), 1_000)
          //
        } catch (error) {
          toast({ canClose: true }).error(
            <>
              Deployment failed.{' '}
              <button
                class="link"
                onClick={() => {
                  dialogError()?.showModal()
                }}
              >
                Why?
              </button>
              <DialogError error={error} />
            </>,
            <IconExclamation />
          )
        } finally {
          setState('busy', false)
        }
      }}
    >
      {children}
    </form>
  )
}
