import {UserMentions} from './user'

export enum MessageTypes {
  HEARTBEAT,
  IDENTIFY,
  MESSAGE
}

export enum MessageIntents {
  CHANNEL_CREATE = 'CHANNEL_CREATE',
  CHANNEL_DELETE = 'CHANNEL_DELETE',
  CHANNEL_PINS_UPDATE = 'CHANNEL_PINS_UPDATE',
  CHANNEL_UPDATE = 'CHANNEL_UPDATE',
  GUILD_CREATE = 'GUILD_CREATE',
  GUILD_DELETE = 'GUILD_DELETE',
  GUILD_INTEGRATIONS_UPDATE = 'GUILD_INTEGRATIONS_UPDATE',
  GUILD_ROLE_CREATE = 'GUILD_ROLE_CREATE',
  GUILD_ROLE_DELETE = 'GUILD_ROLE_DELETE',
  GUILD_ROLE_UPDATE = 'GUILD_ROLE_UPDATE',
  MESSAGE_CREATE = 'MESSAGE_CREATE',
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  MESSAGE_DELETE_BULK = 'MESSAGE_DELETE_BULK',
  MESSAGE_REACTION_ADD = 'MESSAGE_REACTION_ADD',
  MESSAGE_REACTION_REMOVE = 'MESSAGE_REACTION_REMOVE',
  MESSAGE_REACTION_REMOVE_ALL = 'MESSAGE_REACTION_REMOVE_ALL',
  MESSAGE_REACTION_REMOVE_EMOJI = 'MESSAGE_REACTION_REMOVE_EMOJI',
  MESSAGE_UPDATE = 'MESSAGE_UPDATE',
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  READY = 'READY',
  RESUMED = 'RESUMED',
  USER_UPDATE = 'USER_UPDATE',
  VOICE_SERVER_UPDATE = 'VOICE_SERVER_UPDATE',
}

export interface MessageDetails {
  attachments: string[]
  author: {
    avatar: string | null
    bot: boolean
    discriminator: string
    id: string
    public_flags: number
    username: string
  }
  bot: boolean
  channel_id: string
  content: string
  components: string[]
  discriminator: string
  edited_timestamp: string | null
  flags: number
  embeds: string[]
  id: string
  mention_everyone: boolean
  mentions: UserMentions[]
  mention_roles: string[]
  pinned: boolean
  referenced_message?: MessageDetails
  timestamp: string
  tts: boolean
  type: number
}

export interface TextMessage {
  channelId: string
  content: string
  from: {
    id: string
    name: string
  }
  guildId: string
  id: string
  mentions: UserMentions[]
  mentionsEveryone: boolean
  mentionsRoles: string[]
  referencedMessage?: TextMessage
}
