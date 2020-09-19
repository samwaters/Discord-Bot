import {IConfig} from './config/config.interface'
import {IRedis, Redis} from './db/redis'
import {ErrorCodes} from './gateway/errorCodes'
import {Heartbeat, IHeartbeat} from './gateway/heartbeat'
import {MessageIntents, MessageTypes, TextMessage} from './gateway/messageTypes'
import {IMessageHandler, MessageHandler} from './gateway/messageHandler'
import {IPayload, validatePayload} from './gateway/payload'
import {ConnectionStatus} from './gateway/status'
import {IModule} from './module'
import MessageHelper from './modules/helpers/messagehelper'
import {IRestAPI, RestAPI} from './rest/restAPI'
import {formatEndpoint, getWSEndpoint} from './utils/endpoint'
import {ILogger, Logger, LogLevel} from './utils/logger'

import * as WebSocket from 'ws'

export interface IServer {
  heartbeat: IHeartbeat
  logger: ILogger
  redis: IRedis
  restAPI: IRestAPI
  broadcast(message: TextMessage): void
  broadcastEvent(eventType: MessageIntents, event: any)
  getConfig(): IConfig
  getIntent(): number
  getToken(): string
  registerModule(module: IModule): boolean
  sendMessage(messageType: MessageTypes, message: IPayload)
  setConnectionStatus(status: ConnectionStatus)
  start(): void
  stop(): void
}

export interface IServerOpts {
  intent: number
  logLevel: LogLevel
  token: string
}

export class Server implements IServer {
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
  private readonly config: IConfig
  private readonly intent: number
  private messageHandler: IMessageHandler
  private modules:IModule[] = []
  private socket: WebSocket
  private readonly token: string

  public heartbeat: IHeartbeat
  public logger: ILogger
  public redis: IRedis
  public restAPI: IRestAPI

  constructor(config: IConfig, opts: IServerOpts) {
    this.config = config
    this.intent = opts.intent
    this.token = opts.token
    this.logger = new Logger(opts.logLevel)
    this.heartbeat = new Heartbeat(this)
    this.messageHandler = new MessageHandler(this)
    this.redis = new Redis(this, config.redisHost, config.redisPort)
    this.restAPI = new RestAPI(this)
    MessageHelper.init(this)
  }

  private connect(endpoint: string) {
    this.socket = new WebSocket(endpoint)
    this.socket.on('close', (code: number, reason: string) => {
      this.connectionStatus = ConnectionStatus.DISCONNECTED
      this.heartbeat.stop()
      this.logger.warn(`Socket closed remotely: ${reason} (${code})`)
      if([
        ErrorCodes.NORMAL_CLOSURE,
        ErrorCodes.REQUESTING_RECONNECT,
        ErrorCodes.PROTOCOL_ERROR,
        ErrorCodes.ABNORMAL_BEHAVIOUR,
        ErrorCodes.UNKNOWN_ERROR,
      ].includes(code)) {
        this.logger.info('Connection closed, reconnecting')
        this.start()
      }
    })
    this.socket.on('open', () => {
      this.connectionStatus = ConnectionStatus.IDENTIFY
    })
    this.socket.on('error', (err: Error) => {
      // Also need to reconnect
      this.connectionStatus = ConnectionStatus.DISCONNECTED
      this.heartbeat.stop()
      this.logger.error(`Socket error from Discord: ${err.message}`)
    })
    this.socket.on('message', (data: string) => {
      this.messageHandler.handleMessage(JSON.parse(data))
    })
  }

  public broadcast(message: TextMessage) {
    this.modules.forEach((module: IModule) => module.receiveBroadcast(message))
  }

  public broadcastEvent(eventType: MessageIntents, event: any) {
    this.modules.forEach((module: IModule) => module.receiveEvent(eventType, event))
  }

  public getConfig(): IConfig {
    return this.config
  }

  public getIntent(): number {
    return this.intent
  }

  public getToken(): string {
    return this.token
  }

  public registerModule(module: IModule) {
    this.logger.debug(`Registering ${module.name}`)
    this.modules.push(module)
    return true
  }

  public sendMessage(messageType: MessageTypes, message: IPayload) {
    if(this.connectionStatus === ConnectionStatus.DISCONNECTED) {
      this.logger.warn(`Trying to send message while in Disconnected state\n${message}`)
      return
    }
    if(
      this.connectionStatus === ConnectionStatus.IDENTIFY &&
      (messageType !== MessageTypes.IDENTIFY && messageType !== MessageTypes.HEARTBEAT)
    ) {
      this.logger.warn(`Trying to send non-IDENTIFY message while in IDENTIFY state\n${message}`)
      return
    }
    if(!validatePayload(message)) {
      this.logger.warn(`Trying to send invalid message\n${message}`)
      return
    }
    this.socket.send(JSON.stringify(message))
  }

  public setConnectionStatus(status: ConnectionStatus) {
    // TODO: Some validation on the statuses
    this.connectionStatus = status
  }

  public async start() {
    this.logger.info('Starting server')
    const wsEndpoint = await getWSEndpoint(this.config, this.token)
    if(!wsEndpoint.url) {
      this.logger.error(`Error: Cannot get endpoint from Discord! ${wsEndpoint.message}`)
      process.exit(1)
    }
    this.logger.debug(`WS endpoint = ${formatEndpoint(wsEndpoint.url, this.config)}`)
    this.logger.info('Connecting to Discord Gateway')
    this.connect(formatEndpoint(wsEndpoint.url, this.config))
  }

  public stop() {
    this.logger.info('Stopping server')
    this.socket.close()
  }
}
