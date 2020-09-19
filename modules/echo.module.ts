import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'

class EchoModule implements IModule {
  private server: IServer
  public name: string = 'Echo'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  public receiveBroadcast(message: TextMessage) {
    this.server.logger.debug('Echo module processing message')
    if(!message.content.startsWith('!echo ')) return
    this.server.restAPI.request(
      `channels/${message.channelId}/messages`,
      'POST',
      JSON.stringify({
        content: `ECHO: ${message.content.substr(6)}`,
        tts: false
      })
    )
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care about events
  }
}

export default EchoModule
