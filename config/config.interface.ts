export interface IConfig {
  apiBase: string
  encoding: 'etf' | 'json'
  gatewayVersion: number
  redisHost: string
  redisPort: number
  restBase: string
  restPrefix: string
  zlibCompression: boolean
}
