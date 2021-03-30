import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'

class CatModule implements IModule {
  private server: IServer
  public name: string = 'Cat'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  private getAnimatedCat(message: TextMessage) {
    this.getCat(message, 'gif')
  }

  private async getCat(message: TextMessage, type: string) {
    const cat = await get(`https://api.thecatapi.com/v1/images/search?limit=1&mime_types=${type}&order=random&size=med`, {
        'x-api-key': '758fb25e-d5ca-4564-a6ed-b49ad5ea453c'
    })
    if(!cat.length || !cat[0].url) {
        MessageHelper.sendMessage(message.channelId, 'The cat failed to cooperate :(')
        return
    }
    await MessageHelper.sendEmbeddedImage(message.channelId, cat[0].url, {height: cat[0].height, width: cat[0].width})
  }

  private getRandomCat(message: TextMessage) {
    this.getCat(message, 'gif,jpg,png')
  }

  private getStaticCat(message: TextMessage) {
    this.getCat(message, 'jpg,png')
  }

  private processCatCommand(message: TextMessage) {
    const parts: string[] = message.content.split(' ')
    if(parts.length < 2) {
      this.getRandomCat(message)
      return
    }
    const cmd: string = parts[1].toUpperCase()
    try {
      switch(cmd) {
        case 'GIF':
          this.getAnimatedCat(message)
          break
        case 'STATIC':
          this.getStaticCat(message)
          break
        default:
          MessageHelper.sendMessage(message.channelId, `Unknown raffle command ${cmd}`)
          return false
      }
    }
    catch(e) {
      this.server.logger.warn(`Cat Error processing ${cmd}: ${e.message}`)
    }
  }

  public receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!cat')) {
        return
      }
      this.server.logger.debug('Cat module processing command')
      this.processCatCommand(message)
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care about events
  }
}

export default CatModule
