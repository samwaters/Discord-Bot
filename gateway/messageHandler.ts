import {createIdentityPayload} from './identity'
import {IIntentHandler, IntentHandler} from './intentHandler'
import {MessageTypes} from './messageTypes'
import {IPayload} from './payload'
import {IServer} from '../server'

export interface IMessageHandler {
  handleMessage(message: IPayload)
}

export class MessageHandler implements IMessageHandler {
  private intentHandler: IIntentHandler
  private readonly server: IServer

  constructor(server: IServer) {
    this.server = server
    this.intentHandler = new IntentHandler(this.server)
  }

  public handleMessage(message: IPayload) {
    // console.log('INCOMING MESSAGE', message)
    if(message.s) {
      this.server.heartbeat.setSequenceId(message.s)
    }
    switch(message.op) {
      case 0:
        // Pass through to intent handler
        this.intentHandler.handleIntent(message)
        break
      case 10:
        // Heartbeat request
        this.server.heartbeat.setHeartbeatInterval(message.d.heartbeat_interval)
        this.server.heartbeat.start()
        // Identify
        this.server.sendMessage(MessageTypes.IDENTIFY, createIdentityPayload(this.server.getToken(), this.server.getIntent()))
        break
      case 11:
        // Heartbeat ACK
        this.server.heartbeat.receiveHeartbeat()
        break
      default:
        this.server.logger.warn(`Unknown op ${message.op}`)
    }
  }
}
