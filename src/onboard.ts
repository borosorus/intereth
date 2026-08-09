import {init} from '@web3-onboard/react'
import injectedModule from '@web3-onboard/injected-wallets'

const injected = injectedModule()
export const chains = [
    {
        id: '1',
        token: 'ETH',
        label: 'Ethereum Mainnet',
        rpcUrl: 'https://ethereum-rpc.publicnode.com'
      },
      {
        id: '42161',
        token: 'ARB-ETH',
        label: 'Arbitrum One',
        rpcUrl: 'https://arbitrum.drpc.org'
      },
      {
        id: '8453',
        token: 'ETH',
        label: 'Base',
        rpcUrl: 'https://base-rpc.publicnode.com'
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
