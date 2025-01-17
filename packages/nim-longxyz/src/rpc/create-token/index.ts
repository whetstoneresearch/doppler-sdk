import { Drift } from '@delvtech/drift'
import { viemAdapter } from '@delvtech/drift-viem'
import { buildConfig, ReadWriteFactory } from 'doppler-v4-sdk'
import { user } from '~/stores/user'
import { validate, type TokenFields } from '~/components/FormCreateToken'
import {
  addresses,
  buildConfigParams,
  createPublicClient,
  createWalletClient,
  useEvents,
  type Events,
} from './utils'
import {airlockAbi} from "../../../doppler-v4-sdk/abis";

export default function createToken(token: TokenFields) {
  console.log('>> token to create', token)

  const [events, emits] = useEvents()

  return {
    on(event: Events, fn: (props?: any) => void) {
      events.set(event, fn)
      return this
    },
    async deploy() {
      const wallet = user()?.wallet

      /**
       * check inputs
       */
      if (!validate()) {
        emits('error', new Error('Missing inputs'))
        return
      }

      /**
       * check wallet
       */
      if (!wallet) {
        emits('error', new Error('No Wallet found. Are you connected?'))
        return
      }

      /**
       * create public client
       */
      const publicClient = createPublicClient()

      /**
       * create configs
       */
      emits('setting')

      let configParams

      try {
        configParams = await buildConfigParams(publicClient);
        console.log(configParams);
      } catch (error) {
        emits('error', error)
        return
      }

      /**
       * create wallet client
       */
      const address = wallet.address as `0x${string}`
      const walletClient = createWalletClient(address)

      /**
       * start deploying
       */
      emits('deploying')

      const drift = new Drift({
        adapter: viemAdapter({
          // @ts-expect-error doppler test has this mistype
          publicClient,
          walletClient,
        }),
      })

      try {
        const readWriteFactory = new ReadWriteFactory(addresses.airlock, drift)
        const createData = buildConfig(configParams, addresses)
        console.log({ createData })
        await readWriteFactory.create(createData);



        let doppler = null;
        /**
         * deploy
         */
        // ...

        emits('success', doppler)
      } catch (error) {
        emits('error', error)
        console.error(error)
        return
      }
    },
  }
}
