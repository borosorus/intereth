import {init} from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'

const injected = injectedModule()
export const chains = [
    {
        id: '1',
        token: 'ETH',
        label: 'Ethereum Mainnet',
        rpcUrl: 'https://eth.llamarpc.com'
      },
      {
        id: '42161',
        token: 'ARB-ETH',
        label: 'Arbitrum One',
        rpcUrl: 'https://rpc.ankr.com/arbitrum'
      },
      {
        id: '42170',
        token: 'ARB',
        label: 'Arbitrum Nova',
        rpcUrl: 'https://nova.arbitrum.io/rpc'
      },
      {
        id: '8453',
        token: 'ETH',
        label: 'Base',
        rpcUrl: 'https://mainnet.base.org'
      },
      {
        id: '10',
        token: 'OETH',
        label: 'Optimism',
        rpcUrl: 'https://1rpc.io/op'
      }
]
//.export const chainsById = new Map(chains.map((c) => [c.id, c]))
export const web3Onboard = init({
    // This javascript object is unordered meaning props do not require a certain order
    wallets: [injected],
    chains: chains,
  })