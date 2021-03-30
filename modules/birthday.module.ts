import {IModule} from '../module'
import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'

class BirthdayModule implements IModule {
  private server: IServer
  public name: string = 'Birthday'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
  }

  private async addBirthday(message: TextMessage, cmd: string[]) {
      if(cmd.length === 0) {
          MessageHelper.sendMessage(message.channelId, 'Usage: !birthday <date>')
          return
      }
      if(!/^\d{1,2}\/\d{1,2}(\/(\d{2}|\d{4}))?$/.test(cmd[0])) {
          MessageHelper.sendMessage(message.channelId, 'Date format must be in dd/mm or dd/mm/yyyy')
          return
      }
      const birthday = cmd[0].split('/')
      if(birthday[0].length === 1) birthday[0] = "0" + birthday[0]
      if(birthday[1].length === 1) birthday[1] = "0" + birthday[1]
      if(
          parseInt(birthday[0]) < 1
          || parseInt(birthday[0]) > 31
          || parseInt(birthday[1]) < 1
          || parseInt(birthday[1]) > 12
        ) {
        MessageHelper.sendMessage(message.channelId, 'Invalid date for birthday')
        return
      }
      const existingBirthdays = await this.server.redis.get(`birthdays.${message.guildId}.${birthday[1]}.${birthday[0]}`) || '[]'
      const allBirthdays = JSON.parse(existingBirthdays)
      allBirthdays.push(message.from.id)
      await this.server.redis.set(`birthdays.${message.guildId}.${birthday[1]}.${birthday[0]}`, JSON.stringify(allBirthdays))
      MessageHelper.sendMessage(message.channelId, `Birthday for <@!${message.from.id}> set to ${birthday[0]}/${birthday[1]}`)
  }

  private setBirthdayChannel(message: TextMessage, cmd: string[]) {
      if(cmd.length < 2) {
          MessageHelper.sendMessage(message.channelId, 'Usage: !birthday SETCHANNEL <channel>')
          return
      }
  }

  private processBirthdayCommand(message: TextMessage) {
    const parts: string[] = message.content.split(' ')
    if(parts.length === 0) {
      MessageHelper.sendMessage(message.channelId, 'Usage: !birthday <date> or !birthday <cmd>')
      return
    }
    const cmd: string = parts[1].toUpperCase()
    try {
      switch(cmd) {
        case 'SETCHANNEL':
          this.setBirthdayChannel(message, parts.slice(2))
          break
        default:
          this.addBirthday(message, parts.slice(1))
          return false
      }
    }
    catch(e) {
      this.server.logger.warn(`Birthday Error processing ${cmd}: ${e.message}`)
    }
  }

  public receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!birthday')) {
        return
      }
      this.server.logger.debug('Birthday module processing command')
      this.processBirthdayCommand(message)
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care about events
  }
}

export default BirthdayModule
