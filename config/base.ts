import {IConfig} from './config.interface'

export const baseConfig: IConfig = {
  apiBase: 'https://discord.com/api/v9',
  encoding: 'json',
  gatewayVersion: 6,
  redisHost: 'localhost',
  redisPort: 6379,
  restBase: 'discord.com',
  restPrefix: '/api/v9',
  zlibCompression: false
}
