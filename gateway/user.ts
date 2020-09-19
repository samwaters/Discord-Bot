export interface UserMentions {
  avatar: string | null
  bot: boolean
  discriminator: string
  id: string
  member: {
    deaf: boolean
    hoisted_role: string | null
    joined_at: string
    mute: boolean
    nick: string | null
    premium_since: number | null
    roles: string[]
  }
  public_flags: number
  username: string
}

export interface UserInformation {
  avatar: string | null
  bot: boolean
  id: string
  discriminator: string
  email: string | null
  flags: number
  mfa_enabled: boolean
  username: string
  verified: boolean
}
