import { IPayload } from './payload'

export const createIdentityPayload = (token: string, intents: number): IPayload => ({
  op: 2,
  d: {
    token: token,
    properties: {
      '$os': 'mac',
      '$browser': 'squirt-bot',
      '$device': 'squirt-bot'
    },
    compress: false,
    large_threshold: 50,
    guild_subscriptions: false,
    shard: [0, 1],
    presence: {
      game: {
        name: 'the long game',
        type: 0
      },
      status: 'online',
      since: null, // ms since idle
      afk: false
    },
    intents: intents
  }
})
