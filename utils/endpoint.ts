import { IConfig } from '../config/config.interface'
import { IncomingMessage } from 'http'
import { RequestOptions } from 'https'

const https = require('https')

interface IWSEndpoint {
  code?: number
  message?: string
  session_start_limit?: {
    max_concurrency: number
    remaining: number
    reset_after: number
    total: number
  }
  shards?: number
  url?: string
}

export const getWSEndpoint = (config: IConfig, token: string): Promise<IWSEndpoint> => {
  return new Promise((resolve, reject) => {
    const options: RequestOptions = {
      headers:{
        "Authorization": "Bot " + token
      }
    }
    https.get(config.apiBase + '/gateway/bot', options, (res: IncomingMessage) => {
      let response: string = ''
      res.on('data', (data: string) => {
        response += data
      })
      res.on('end', () => {
        resolve(JSON.parse(response))
      })
      res.on('error', (err: Error) => {
        reject('HTTPS error: ' + err.message)
      })
    })
  })
}

export const formatEndpoint = (url: string, config: IConfig) => {
  return `${url}/?v=${config.gatewayVersion}&encoding=${config.encoding}`
}
