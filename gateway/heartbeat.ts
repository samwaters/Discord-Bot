import {MessageTypes} from './messageTypes'
import {IServer} from '../server'

export interface IHeartbeat {
  receiveHeartbeat()
  setHeartbeatInterval(interval: number)
  setSequenceId(id: number)
  start()
  stop()
}

export class Heartbeat implements IHeartbeat {
  private heartbeatInterval: number
  private heartbeatReceived: boolean
  private intervalId: NodeJS.Timeout
  private sequenceId: number = null
  private server: IServer
  
  constructor(server: IServer) {
    this.server = server
  }

  private heartbeat() {
    if(!this.heartbeatReceived) {
      this.server.logger.error('Heartbeat called without receiving an ack from the server')
      this.server.stop()
      return
    }
    this.server.logger.debug(`Sending heartbeat (seq ${this.sequenceId})`)
    this.server.sendMessage(MessageTypes.HEARTBEAT, {
      op: 1,
      d: this.sequenceId
    })
    this.heartbeatReceived = false
  }

  public receiveHeartbeat() {
    this.server.logger.debug('Heartbeat received')
    this.heartbeatReceived = true
  }

  public setHeartbeatInterval(interval: number) {
    this.server.logger.debug(`Setting heartbeat to ${interval}ms`)
    this.heartbeatInterval = interval
  }

  public setSequenceId(id: number) {
    this.sequenceId = id
  }

  public start() {
    this.heartbeatReceived = true
    this.heartbeat()
    this.intervalId = setInterval(() => this.heartbeat(), this.heartbeatInterval)
  }

  public stop() {
    clearInterval(this.intervalId)
  }
}
