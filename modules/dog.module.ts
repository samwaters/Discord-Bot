import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'

class DogModule implements IModule {
  private server: IServer
  public name: string = 'Dog'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  private getAnimatedDog(message: TextMessage) {
    this.getDog(message, 'gif')
  }

  private async getDog(message: TextMessage, type: string) {
    const dog = await get(`https://api.thedogapi.com/v1/images/search?limit=1&mime_types=${type}&order=random&size=med`, {
        'x-api-key': '90fda416-92f3-4df7-9ba6-39b116cf0649'
    })
    if(!dog.length || !dog[0].url) {
        MessageHelper.sendMessage(message.channelId, 'The dog failed to cooperate :(')
        return
    }
    await MessageHelper.sendEmbeddedImage(message.channelId, dog[0].url, {height: dog[0].height, width: dog[0].width})
  }

  private getRandomDog(message: TextMessage) {
    this.getDog(message, 'gif,jpg,png')
  }

  private getStaticDog(message: TextMessage) {
    this.getDog(message, 'jpg,png')
  }

  private processDogCommand(message: TextMessage) {
    const parts: string[] = message.content.split(' ')
    if(parts.length < 2) {
      this.getRandomDog(message)
      return
    }
    const cmd: string = parts[1].toUpperCase()
    try {
      switch(cmd) {
        case 'GIF':
          this.getAnimatedDog(message)
          break
        case 'STATIC':
          this.getStaticDog(message)
          break
        default:
          MessageHelper.sendMessage(message.channelId, `Unknown dog command ${cmd}`)
          return false
      }
    }
    catch(e) {
      this.server.logger.warn(`Dog Error processing ${cmd}: ${e.message}`)
    }
  }

  public receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!dog')) {
        return
      }
      this.server.logger.debug('Dog module processing command')
      this.processDogCommand(message)
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care about events
  }
}

export default DogModule
