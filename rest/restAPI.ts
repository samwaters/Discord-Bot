import {IServer} from '../server'
import * as https from 'https'

export interface IRestAPI {
  request(path: string, method: string, data?: any): Promise<string>
}

export class RestAPI implements IRestAPI {
  private server: IServer

  constructor(server: IServer) {
    this.server = server
  }

  public request(path: string, method: string = 'GET', data?: any) {
    return new Promise<string>((resolve, reject) => {
      const req = https.request({
        headers: {
          Authorization: `Bot ${this.server.getToken()}`,
          'Content-Type': 'application/json'
        },
        host: this.server.getConfig().restBase,
        method,
        path: `${this.server.getConfig().restPrefix}/${path}`,
        port: 443
      }, res => {
        let response: string = ''
        res.on('data', (data: string) => response += data)
        res.on('end', () => resolve(response))
        res.on('error', reject)
      })
      req.on('error', reject)
      if(method === 'POST') {
        req.write(data)
      }
      req.end()
    })
  }
}
