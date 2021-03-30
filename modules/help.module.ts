import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'

class HelpModule implements IModule {
  private server: IServer
  public name: string = 'Help'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  private processHelpCommand(message: TextMessage) {
    const modules = this.server.getModules()
    const moduleNames = modules.reduce((prev, cur) => `${prev} - ${cur.name} v${cur.version}\n`, '')
    MessageHelper.sendMessage(message.channelId, `Squirt-Bot running with modules:\n\`\`\`${moduleNames}\`\`\``)
  }

  public receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!help')) {
        return
      }
      this.server.logger.debug('Help module processing command')
      this.processHelpCommand(message)
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care about events
  }
}

export default HelpModule
