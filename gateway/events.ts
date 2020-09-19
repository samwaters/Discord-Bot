export interface IReactionEvent {
  user_id: string
  message_id: string
  member: {
    user: {
      username: string
      id: string
      discriminator: string
      avatar: string
    }
    roles: string[]
    mute: boolean
    joined_at: string
    hoisted_role: string | null
    deaf: boolean
  }
  emoji: {
    name: string
    id: string | null
  }
  channel_id: string
  guild_id: string
}
