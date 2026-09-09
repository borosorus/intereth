import {init} from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'
import { chains } from './chainConfig'

export { chains, chainsById } from './chainConfig'

const injected = injectedModule()
const walletChains = chains.map(({id, token, label, rpcUrl}) => ({id, token, label, rpcUrl}))

export const web3Onboard = init({
    // This javascript object is unordered meaning props do not require a certain order
    wallets: [injected],
    chains: walletChains,
    accountCenter: {
      desktop: {
        enabled: true,
        position: 'bottomLeft'
      },
      mobile: {
        enabled: true,
        position: 'bottomLeft'
      }
    }
  })
