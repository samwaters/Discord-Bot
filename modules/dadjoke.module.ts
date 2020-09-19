import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {httpsGet} from './helpers/https'

class DadJokeModule implements  IModule {
  private server: IServer
  public name: string = 'DadJoke'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  private getJoke(): Promise<string> {
    return httpsGet('icanhazdadjoke.com')
  }

  public receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!dadjoke')) {
      return
    }
    this.getJoke().then(
      (joke: string) => {
        const jokeData = JSON.parse(joke)
        this.sendMessage(message.channelId, jokeData.joke)
      },
      (err: Error) => {
        this.sendMessage(message.channelId, `Error fetching joke: ${err.message}`)
      }
    )
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care
  }

  private sendMessage(channel: string, message: string) {
    this.server.restAPI.request(
      `channels/${channel}/messages`,
      'POST',
      JSON.stringify({
        content: message,
        tts: false
      })
    )
  }
}

export default DadJokeModule
