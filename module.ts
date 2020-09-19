import {MessageIntents, TextMessage} from './gateway/messageTypes'

export interface IModule {
  name: string
  version: string
  receiveBroadcast(message: TextMessage)
  receiveEvent(eventType: MessageIntents, event: any)
}
