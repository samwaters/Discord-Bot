import * as redis from 'redis'
import { ClientOpts } from 'redis'
import { IServer } from '../server'
import { promisify } from 'util'

export interface IRedis {
  get(key: string): Promise<string>
  getMultiple(keys: string[]): Promise<string[]>
  deleteKey(key: string): void
  keys(key: string): Promise<string[]>
  set(key: string, data: string): void
}

export class Redis implements IRedis {
  private readonly client: redis.RedisClient
  private readonly getter: (key: string) => Promise<string>
  private readonly getKeys: (key: string) => Promise<string[]>
  private readonly multiple: (keys: string[]) => Promise<string[]>
  private server: IServer

  constructor(server: IServer, host?: string, port?: number, opts?: ClientOpts) {
    this.server = server
    this.client = redis.createClient(port, host, opts)
    this.getter = promisify(this.client.get).bind(this.client)
    this.getKeys = promisify(this.client.keys).bind(this.client)
    this.multiple = promisify(this.client.mget).bind(this.client)
    this.client.on('error', (err: Error) => {
      this.server.logger.error(`Redis error: ${err.message}`)
    })
    this.client.on('ready', () => {
      this.server.logger.debug('Redis connection ready')
    })
  }

  public async get(key: string) {
    const data:string = await this.getter(key)
    return data
  }

  public async getMultiple(keys: string[]) {
    const data: string[] = await this.multiple(keys)
    return data
  }

  public deleteKey(key: string) {
    this.client.del(key)
  }

  public async keys(key: string) {
    const data:string[] = await this.getKeys(key)
    return data
  }

  public set(key: string, data: string) {
    this.client.set(key, data)
  }
}
