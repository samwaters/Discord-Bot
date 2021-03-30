import {IServer} from '../../server'

interface ImageDimensions {
  height: number
  width: number
}

class MessageHelper {
  private static server: IServer

  static init(server: IServer) {
    MessageHelper.server = server
  }

  static addReaction(channel: string, messageId: string, emoji: string): Promise<string> {
    return MessageHelper.server.restAPI.request(
      `channels/${channel}/messages/${messageId}/reactions/${encodeURI(emoji)}/@me`,
      'PUT',
      '{}'
    )
  }

  static addMultipleReactions(channel: string, messageId: string, emojis: string[]) {
    if(emojis.length === 0) return
    MessageHelper.addReaction(channel, messageId, emojis[0]).then(
      () => setTimeout(
        () => MessageHelper.addMultipleReactions(channel, messageId, emojis.slice(1)),
        100
      )
    )
  }

  static sendMessage(channel: string, message: string): Promise<string> {
    return MessageHelper.server.restAPI.request(
      `channels/${channel}/messages`,
      'POST',
      JSON.stringify({
        content: message,
        tts: false
      })
    )
  }

  static sendEmbeddedImage(channel: string, imageUrl: string, dimensions?: ImageDimensions): Promise<string> {
    dimensions = dimensions ? dimensions : { height: 500, width: 500 }
    return MessageHelper.server.restAPI.request(
      `channels/${channel}/messages`,
      'POST',
      JSON.stringify({
        embed: {
          image: {
            ...dimensions,
            url: imageUrl
          }
        },
        tts: false
      })
    )
  }

  static sendMultipleMessages(channel: string, messages: string[]): Promise<string> {
    if(messages.length === 0) return
    MessageHelper.sendMessage(channel, messages[0]).then(
      () => setTimeout(
        () => MessageHelper.sendMultipleMessages(channel, messages.slice(1)),
        100
      )
    )
  }
}

export default MessageHelper
