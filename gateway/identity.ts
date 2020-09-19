import { IPayload } from './payload'

export const createIdentityPayload = (token: string, intents: number): IPayload => ({
  op: 2,
  d: {
    token: token,
    properties: {
      '$os': 'mac',
      '$browser': 'raffle-bot',
      '$device': 'raffle-bot'
    },
    compress: false,
    large_threshold: 50,
    guild_subscriptions: false,
    shard: [0, 1],
    presence: {
      game: {
        name: '!raffle help',
        type: 0
      },
      status: 'online',
      since: null, // ms since idle
      afk: false
    },
    intents: intents
  }
})
