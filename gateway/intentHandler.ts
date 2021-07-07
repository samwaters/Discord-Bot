import {MessageIntents} from './messageTypes'
import {IPayload} from './payload'
import {IServer} from '../server'
import {ConnectionStatus} from './status'

export interface IIntentHandler {
  handleIntent(message: IPayload)
}

export class IntentHandler {
  private botUserId: string = ''
  private server: IServer

  constructor(server: IServer) {
    this.server = server
  }

  public handleIntent(message: IPayload) {
    // console.log('INCOMING INTENT', message)
    switch(message.t) {
      case MessageIntents.READY:
        this.server.logger.debug('Ready event received')
        this.server.setConnectionStatus(ConnectionStatus.READY)
        this.server.redis.set('bot.user', JSON.stringify(message.d.user))
        this.server.redis.set('session.id', message.d.session_id)
        this.botUserId = message.d.user.id
        break
      case MessageIntents.GUILD_CREATE:
        // Oooo, added to a new guild
        this.server.redis.set(
          `guilds.${message.d.id}`,
          JSON.stringify({
            name: message.d.name,
            owner: message.d.owner_id
          })
        )
        break
      case MessageIntents.MESSAGE_CREATE:
        if(message.d.author.id !== this.botUserId) {
          this.server.broadcast({
            channelId: message.d.channel_id,
            content: message.d.content,
            from: {
              id: message.d.author.id,
              name: message.d.author.name
            },
            guildId: message.d.guild_id,
            id: message.d.id,
            mentions: message.d.mentions,
            mentionsEveryone: message.d.mention_everyone,
            mentionsRoles: message.d.mention_roles,
            referencedMessage: {
              channelId: message.d.referenced_message?.channel_id,
              content: message.d.refenced_message?.content,
              from: {
                id: message.d.referenced_message?.author.id,
                name: message.d.referenced_message?.author.name
              },
              guildId: message.d.referenced_message?.guild_id,
              id: message.d.referenced_message?.id,
              mentions: message.d.referenced_message?.mentions,
              mentionsEveryone: message.d.referenced_message?.mention_everyone,
              mentionsRoles: message.d.referenced_message?.mention_roles,
            },
          })
        }
        break
      case MessageIntents.MESSAGE_DELETE:
      case MessageIntents.MESSAGE_DELETE_BULK:
      case MessageIntents.MESSAGE_REACTION_ADD:
      case MessageIntents.MESSAGE_REACTION_REMOVE:
      case MessageIntents.MESSAGE_REACTION_REMOVE_ALL:
      case MessageIntents.MESSAGE_REACTION_REMOVE_EMOJI:
      case MessageIntents.MESSAGE_UPDATE:
        this.server.broadcastEvent(message.t, message.d)
        break
      case MessageIntents.PRESENCE_UPDATE:
        // Someone changed status?
        break
      default:
        this.server.logger.warn(`Unknown intent ${message.t}`)
    }
  }
}
