import {MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IModule} from '../module'
import {IServer} from '../server'
import MessageHelper from './helpers/messagehelper'

interface RaffleData {
  admins: string[]
  created: string
  maxTickets: number
  owner: string
  status: string
  ticketPrice: string
}

interface RaffleTicket {
  name: string
  purchased: string
  quantity: number
}

class RaffleModule implements IModule {
  private server: IServer
  public name: string = 'Raffle'
  public version: string = '1.0.9'

  constructor(server: IServer) {
    this.server = server
  }

  private async addPrize(message: TextMessage, command: string[]) {
    if(command.length < 2) {
      // [0] = raffle id, [1...x] = prize name
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle addprize <name> <prize>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if(!isValidOwnership) return
    const prizes = await this.server.redis.get(`raffle.${message.guildId}.prizes.${command[0]}`)
    const prizeData = JSON.parse(prizes)
    prizeData.push(command.slice(1).join(' '))
    this.server.redis.set(`raffle.${message.guildId}.prizes.${command[0]}`, JSON.stringify(prizeData))
    await MessageHelper.sendMessage(
      message.channelId,
      `Prize "${command.slice(1).join(' ')}" added successfully to raffle`
    )
  }

  private async addRaffleAdmin(message: TextMessage, command: string[]) {
    if(command.length !== 2) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle addraffleadmin <name> <admin>\n<name>: The raffle name\n<admin>The @ name of the person to grant admin privileges to')
      return
    }
    if(!/^<@!\d+>/.test(command[1])) {
      await MessageHelper.sendMessage(message.channelId, 'You must tag an admin to add them to the raffle')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if (!isValidOwnership) return

    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    raffleData.admins.push(command[1].replace(/[^\d]/g, ''))
    const updatedRaffleData: RaffleData = {
      ...raffleData,
    }
    this.server.redis.set(
      `raffle.${message.guildId}.details.${command[0]}`,
      JSON.stringify(updatedRaffleData)
    )
    await MessageHelper.sendMessage(message.channelId, `${command[1]} is now an admin of the ${command[0]} raffle`)
  }

  private async addTickets(message: TextMessage, command: string[]) {
    if(command.length != 3 || !/^\d+$/.test(command[2])) {
      // [0] = raffle id, [1] = ticket owner, [2] = quantity
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle addtickets <name> <person> <number>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if(!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const tickets = await this.server.redis.get(`raffle.${message.guildId}.tickets.${command[0]}`)
    const ticketData: RaffleTicket[] = JSON.parse(tickets)
    let ticketsToAdd: number = parseInt(command[2])
    let isOverMax: boolean = false
    if(raffleData.maxTickets > 0) {
      const currentTickets: number = ticketData
        .filter(ticket => ticket.name === command[1])
        .reduce((acc: number, cur: RaffleTicket) => acc + cur.quantity, 0)
      if(currentTickets >= raffleData.maxTickets) {
        await MessageHelper.sendMessage(message.channelId, `${command[1]} already has the maximum of ${raffleData.maxTickets} tickets`)
        return
      }
      if(currentTickets + ticketsToAdd > raffleData.maxTickets) {
        isOverMax = true
        ticketsToAdd = raffleData.maxTickets - currentTickets
      }
    }

    ticketData.push({name: command[1], purchased: new Date().toISOString(), quantity: ticketsToAdd})
    this.server.redis.set(`raffle.${message.guildId}.tickets.${command[0]}`, JSON.stringify(ticketData))
    const ticketMessage: string = isOverMax
      ? `Added ${ticketsToAdd} tickets as ${command[1]} has reached their ticket limit`
      : `Added ${ticketsToAdd} tickets for ${command[1]}`
    await MessageHelper.sendMessage(message.channelId, ticketMessage)
  }

  private async checkRaffleOwnership(message: TextMessage, raffleId: string, requiredStatus?: string): Promise<boolean> {
    const raffle: string = await this.server.redis.get(`raffle.${message.guildId}.details.${raffleId}`)
    if(!raffle) {
      await MessageHelper.sendMessage(message.channelId, `Raffle ${raffleId} does not exist`)
      return false
    }
    let raffleData: RaffleData = JSON.parse(raffle)
    if(raffleData.owner !== message.from.id && !raffleData.admins.includes(message.from.id)) {
      await MessageHelper.sendMessage(
        message.channelId,
        `You do not own, or have permission to manage, this raffle! This raffle is owned by <@!${raffleData.owner}> and managed by ${raffleData.admins.join(',')}`
      )
      return false
    }
    if(requiredStatus && raffleData.status !== requiredStatus) {
      await MessageHelper.sendMessage(
        message.channelId,
        `The raffle is not in the ${requiredStatus} state, it is currently ${raffleData.status}`
      )
      return
    }
    return true
  }

  private async deleteRaffle(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle delete <name>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0])
    if (!isValidOwnership) return
    this.server.redis.deleteKey(`raffle.${message.guildId}.details.${command[0]}`)
    this.server.redis.deleteKey(`raffle.${message.guildId}.prizes.${command[0]}`)
    this.server.redis.deleteKey(`raffle.${message.guildId}.tickets.${command[0]}`)
    this.server.redis.deleteKey(`raffle.${message.guildId}.winners.${command[0]}`)
    await MessageHelper.sendMessage(message.channelId, 'Raffle deleted successfully')
  }

  private async deleteRafflePrize(message: TextMessage, command: string[]) {
    if(command.length < 2) {
      // [0] = raffle id, [1...x] = prize name
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle deleteprize <name>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if(!isValidOwnership) return
    const prizeName = command.slice(1).join(' ')
    const prizes = await this.server.redis.get(`raffle.${message.guildId}.prizes.${command[0]}`)
    let prizeData = JSON.parse(prizes)
    prizeData = prizeData.filter(prize => prize !== prizeName)
    this.server.redis.set(`raffle.${message.guildId}.prizes.${command[0]}`, JSON.stringify(prizeData))
    await MessageHelper.sendMessage(
      message.channelId,
      `Prize "${prizeName}" removed from raffle ${command[0]}`
    )
  }

  private async deleteTickets(message: TextMessage, command: string[]) {
    if(command.length < 2) {
      // [0] = raffle id, [1] = ticket owner [2] = number to delete
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle deletetickets <name> <owner> <number>')
      return
    }
    if(command[2] && !/^\d+$/.test(command[2])) {
      await MessageHelper.sendMessage(message.channelId, 'Invald number of tickets to delete')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if(!isValidOwnership) return
    const numberToDelete: number = command[2] ? parseInt(command[2]) : 0
    const tickets = await this.server.redis.get(`raffle.${message.guildId}.tickets.${command[0]}`)
    let ticketData = JSON.parse(tickets)
    if(numberToDelete === 0) {
      ticketData = ticketData.filter((ticket: RaffleTicket) => ticket.name !== command[1])
    } else {
      const ticketCount = ticketData.reduce(
        (acc: number, cur: RaffleTicket) => cur.name === command[1] ? acc + cur.quantity : acc,
        0
      )
      if(ticketCount - numberToDelete < 0) {
        await MessageHelper.sendMessage(message.channelId, `${command[1]} does not have enough tickets to remove ${numberToDelete}`)
        return
      }
      let numberToRetain = ticketCount - numberToDelete
      ticketData = ticketData.map((ticket: RaffleTicket) => {
        if(ticket.name !== command[1]) {
          return ticket
        }
        if(numberToRetain <= 0) {
          return {
            ...ticket,
            quantity: 0
          }
        }
        if(ticket.quantity <= numberToRetain) {
          numberToRetain -= ticket.quantity
          return ticket
        }
        if(ticket.quantity > numberToRetain) {
          const newTicket = {
            ...ticket,
            quantity: numberToRetain
          }
          numberToRetain -= ticket.quantity
          return newTicket
        }
      })
      ticketData = ticketData.filter((ticket: RaffleTicket) => ticket.quantity > 0)
    }

    this.server.redis.set(`raffle.${message.guildId}.tickets.${command[0]}`, JSON.stringify(ticketData))
    await MessageHelper.sendMessage(
      message.channelId,
      `${numberToDelete > 0 ? numberToDelete : 'All'} tickets removed for "${command[1]}"`
    )
  }

  private async drawRaffle(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle draw <name>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if (!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const prizes = await this.server.redis.get(`raffle.${message.guildId}.prizes.${command[0]}`)
    const tickets = await this.server.redis.get(`raffle.${message.guildId}.tickets.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const prizeData: string[] = JSON.parse(prizes)
    const ticketData: RaffleTicket[] = JSON.parse(tickets)
    const fullTicketCount = ticketData.reduce((acc: number, cur: RaffleTicket) => acc + cur.quantity, 0)
    const taggedTest = /^<@!\d+>/
    const ticketCountWithoutAdmins = ticketData.reduce(
      (acc: number, cur: RaffleTicket) => {
        // Can't be an admin if it's not tagged
        const isAdminTicket = taggedTest.test(cur.name) &&
          (
            raffleData.owner === cur.name.replace(/[^\d]/g, '') ||
            raffleData.admins.includes(cur.name.replace(/[^\d]/g, ''))
          )
        return isAdminTicket ? acc : acc + cur.quantity
      },
      0
    )
    if(prizeData.length > ticketCountWithoutAdmins) {
      await MessageHelper.sendMessage(message.channelId, 'Cannot draw raffle - not enough tickets to cover all prizes')
      return
    }
    const ticketMap = ticketData.map(ticket => new Array(ticket.quantity).fill(ticket.name)).flat()
    const winningTicketNumbers = []
    const winners = []
    const winnerData = []
    for(let i=0; i<prizeData.length; i++) {
      let ticketNumber = Math.floor(Math.random() * fullTicketCount)
      let isAdminTicket = taggedTest.test(ticketMap[ticketNumber]) &&
        (
          raffleData.owner === ticketMap[ticketNumber].replace(/[^\d]/g, '') ||
          raffleData.admins.includes(ticketMap[ticketNumber].replace(/[^\d]/g, ''))
        )
      while(winningTicketNumbers.indexOf(ticketNumber) !== -1 || isAdminTicket) {
        ticketNumber = Math.floor(Math.random() * fullTicketCount)
        isAdminTicket = taggedTest.test(ticketMap[ticketNumber]) &&
          (
            raffleData.owner === ticketMap[ticketNumber].replace(/[^\d]/g, '') ||
            raffleData.admins.includes(ticketMap[ticketNumber].replace(/[^\d]/g, ''))
          )
      }
      winningTicketNumbers.push(ticketNumber)
      winners.push(ticketMap[ticketNumber])
      winnerData.push({ticketNumber: ticketNumber, winner: ticketMap[ticketNumber]})
    }
    const prizeStr = winners.map(
      (winner: string, idx: number) => `Prize ${idx + 1} - ${prizeData[idx]}: ${winner} (Ticket #${winningTicketNumbers[idx] + 1})`
    ).join('\n')
    await MessageHelper.sendMessage(
      message.channelId,
      `Raffle ${command[0]}\nDrawn at: ${this.formatDate(new Date().toISOString())}\n\n${prizeStr}\n\nCongratulations to all winners!`
    )
    this.server.redis.set(
      `raffle.${message.guildId}.winners.${command[0]}`,
      JSON.stringify(winnerData)
    )
    this.server.redis.set(
      `raffle.${message.guildId}.details.${command[0]}`,
      JSON.stringify({
        ...raffleData,
        status: 'DRAWN'
      })
    )
  }

  private formatDate(dateStr: string): string {
    const date: Date = new Date(dateStr)
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
  }

  private async listRaffles(message: TextMessage) {
    const allRaffleNames: string[] = await this.server.redis.keys(`raffle.${message.guildId}.details.*`)
    const raffleMessages: string[] = []
    for(let i=0; i<Math.ceil(allRaffleNames.length / 10); i++) {
      const raffleNames = allRaffleNames.slice(i*10, i*10+10)
      const raffles = await this.server.redis.getMultiple(raffleNames)
      raffles.forEach((raffle: string, idx: number) => {
        const raffleData: RaffleData = JSON.parse(raffle)
        if(raffleData.status === 'OPEN') {
          raffleMessages.push(
            `${raffleNames[idx].split('.').pop()}: Created ${this.formatDate(raffleData.created)}, Owner <@!${raffleData.owner}>`
          )
        }
      })
    }
    if(raffleMessages.length > 0) {
      await MessageHelper.sendMessage(message.channelId, raffleMessages.join('\n'))
    } else {
      await MessageHelper.sendMessage(message.channelId, 'There are no active raffles in this guild')
    }
  }

  private async listTickets(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, `Usage: !raffle tickets <name>`)
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0])
    if (!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const tickets = await this.server.redis.get(`raffle.${message.guildId}.tickets.${command[0]}`)
    const ticketData: RaffleTicket[] = JSON.parse(tickets)
    const ticketCount = ticketData.reduce((acc: number, cur: RaffleTicket) => acc + cur.quantity, 0)
    const messagesToSend = []
    let ticketMessages: string[] = []
    ticketData.forEach((ticket: RaffleTicket) => {
      const isAdmin = /^<@!\d+>$/.test(ticket.name) &&
        (
          raffleData.owner === ticket.name.replace(/[^\d]/g, '') ||
          raffleData.admins.includes(ticket.name.replace(/[^\d]/g, ''))
        )
      let ticketMessage: string = `${ticket.name} x${ticket.quantity}, purchased ${this.formatDate(ticket.purchased)}`
      if(isAdmin)
        ticketMessage += ' [ADMIN]'
      if(ticketMessages.join('\n').length + ticketMessage.length >= 1800) {
        messagesToSend.push(ticketMessages.join('\n'))
        ticketMessages = []
      }
      ticketMessages.push(ticketMessage)
    })
    ticketMessages.push(`\n**Admin tickets are automatically excluded from the draw**`)
    ticketMessages.push(`Total: ${ticketCount}`)
    messagesToSend.push(ticketMessages.join('\n'))
    await MessageHelper.sendMultipleMessages(message.channelId, messagesToSend)
  }

  private async newRaffle(message: TextMessage, command: string[]) {
    if(command.length < 1 || command.length > 3 || command[0].length > 32 || !/^[A-Za-z0-9\-]+$/.test(command[0])) {
      await MessageHelper.sendMessage(
        message.channelId,
        'Usage: !raffle create <name> <maxtickets>\n<name>: Raffle name (32 characters max)\n<maxtickets>: Max tickets per person (optional)'
      )
      return
    }
    if(command[1] && !/^\d+$/.test(command[1])) {
      await MessageHelper.sendMessage(message.channelId, 'Invalid Maximum Tickets')
      return
    }
    // [0] = name, [1] = max tickets, [2] = ticket price
    const raffle: string = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    if(raffle) {
      await MessageHelper.sendMessage(message.channelId, `Raffle ${command[0]} already exists}`)
      return
    }
    this.server.redis.set(
      `raffle.${message.guildId}.details.${command[0]}`,
      JSON.stringify({
        admins: [],
        created: new Date().toISOString(),
        maxTickets: command[1] ? parseInt(command[1]) : 10,
        owner: message.from.id,
        status: 'OPEN',
        ticketPrice: command[2] || '5k'
      })
    )
    this.server.redis.set(`raffle.${message.guildId}.prizes.${command[0]}`, JSON.stringify([]))
    this.server.redis.set(`raffle.${message.guildId}.tickets.${command[0]}`, JSON.stringify([]))
    this.server.redis.set(`raffle.${message.guildId}.winners.${command[0]}`, JSON.stringify([]))
    await MessageHelper.sendMessage(message.channelId, `Raffle ${command[0]} created successfully`)
  }

  private processRaffleCommand(message: TextMessage): boolean {
    const parts: string[] = message.content.split(' ')
    if(parts.length < 2) {
      return false
    }
    const cmd: string = parts[1].toUpperCase()
    try {
      switch(cmd) {
        case 'ADDADMIN':
          this.addRaffleAdmin(message, parts.slice(2))
          break
        case 'ADDPRIZE':
          this.addPrize(message, parts.slice(2))
          break
        case 'ADDTICKETS':
          this.addTickets(message, parts.slice(2))
          break
        case 'CREATE':
          this.newRaffle(message, parts.slice(2))
          break
        case 'DELETE':
          this.deleteRaffle(message, parts.slice(2))
          break
        case 'DELETEPRIZE':
          this.deleteRafflePrize(message, parts.slice(2))
          break
        case 'DELETETICKETS':
          this.deleteTickets(message, parts.slice(2))
          break
        case 'DRAW':
          this.drawRaffle(message, parts.slice(2))
          break
        case 'HELP':
          this.raffleHelp(message)
          break
        case 'LIST':
          this.listRaffles(message)
          break
        case 'MAXTICKETS':
          this.setMaxTickets(message, parts.slice(2))
          break
        case 'STATUS':
          this.raffleStatus(message, parts.slice(2))
          break
        case 'TICKETS':
          this.listTickets(message, parts.slice(2))
          break
        case 'TICKETPRICE':
          this.setTicketPrice(message, parts.slice(2))
          break
        case 'VERSION':
          this.sendVersion(message)
          break
        default:
          MessageHelper.sendMessage(message.channelId, `Unknown raffle command ${cmd}`)
          return false
      }
    } catch(e) {
      this.server.logger.warn(`Error processing ${cmd}: ${e.message}`)
    }
  }

  private raffleHelp(message: TextMessage) {
    MessageHelper.sendMessage(
      message.channelId,
      `Raffle Bot Commands: (All commands are prefixed with \`!raffle\`)
\`addadmin\` _<raffle name>_ _<admin>_ - Adds an admin to the raffle
\`addprize\` _<raffle name>_ _<prize>_ - Adds a prize to the raffle
\`addtickets\` _<raffle name>_ _<name>_ _<number>_ - Adds tickets to the raffle
\`create\` _<raffle name>_ - Creates a new raffle
\`delete\` _<raffle name>_ - Deletes a raffle
\`deleteprize\` _<raffle name>_ _<prize name>_ - Deletes a prize
\`deletetickets\` _<raffle name>_ _<name>_ _<number>_ - Deletes <number> of tickets for <owner>. If no number is specified, all tickets are removed
\`draw\` _<raffle name>_ - Draws a raffle
\`help\` - Shows this message
\`list\` - Shows all active raffles
\`maxtickets\` _<raffle name>_ _<number>_ - Sets the maximum number of tickets per person
\`status\` _<raffle name>_ - Shows the status of the raffle
\`tickets\` _<raffle name>_ - Shows a list of all tickets purchased
\`ticketprice\` _<raffle name>_ _<price>_ - Sets the price of each ticket 
\`version\` - Shows the current version of raffle-bot`
    )
  }

  private async raffleStatus(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle status <name>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0])
    if (!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const prizes = await this.server.redis.get(`raffle.${message.guildId}.prizes.${command[0]}`)
    const tickets = await this.server.redis.get(`raffle.${message.guildId}.tickets.${command[0]}`)
    const winners = await this.server.redis.get(`raffle.${message.guildId}.winners.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const prizeData: string[] = JSON.parse(prizes)
    const ticketData: RaffleTicket[] = JSON.parse(tickets)
    const winnerData = JSON.parse(winners)
    const raffleStr = `Raffle ${command[0]}\nStatus: ${raffleData.status}`
    let prizeStr = ''
    if(raffleData.status === 'DRAWN') {
      prizeStr = prizeData.map((prize: string, idx: number) => `Prize ${idx + 1}: ${prize} - Won By ${winnerData[idx].winner} (Ticket #${winnerData[idx].ticketNumber})`).join('\n')
    } else {
      prizeStr = prizeData.map((prize: string, idx: number) => `Prize ${idx + 1}: ${prize}`).join('\n')
    }
    const ticketCount = ticketData.reduce((acc, cur) => acc + cur.quantity, 0)
    await MessageHelper.sendMessage(
      message.channelId,
      `${raffleStr}
${prizeStr}
Tickets sold: ${ticketCount}

**To buy tickets, deposit ${raffleData.ticketPrice} into the guild bank, up to a maximum of ${raffleData.maxTickets}**
Bonus prizes added for every 50 tickets sold! 
`
    )
  }

  private sendVersion(message: TextMessage) {
    MessageHelper.sendMessage(message.channelId, `raffle-bot version ${this.version}`)
  }

  private async setMaxTickets(message: TextMessage, command: string[]) {
    if(command.length !== 2 || !/^\d+$/.test(command[1])) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle setMaxTickets <name> <number>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if (!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const updatedRaffleData: RaffleData = {
      ...raffleData,
      maxTickets: parseInt(command[1])
    }
    this.server.redis.set(
      `raffle.${message.guildId}.details.${command[0]}`,
      JSON.stringify(updatedRaffleData)
    )
    await MessageHelper.sendMessage(message.channelId, `Max tickets set to ${command[1]} for raffle ${command[0]}`)
  }

  private async setTicketPrice(message: TextMessage, command: string[]) {
    if(command.length !== 2) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: !raffle ticketprice <name> <price>')
      return
    }
    const isValidOwnership = await this.checkRaffleOwnership(message, command[0], 'OPEN')
    if (!isValidOwnership) return
    const raffle = await this.server.redis.get(`raffle.${message.guildId}.details.${command[0]}`)
    const raffleData: RaffleData = JSON.parse(raffle)
    const updatedRaffleData: RaffleData = {
      ...raffleData,
      ticketPrice: command[1]
    }
    this.server.redis.set(
      `raffle.${message.guildId}.details.${command[0]}`,
      JSON.stringify(updatedRaffleData)
    )
    MessageHelper.sendMessage(message.channelId, `Ticket price set to ${command[1]} for raffle ${command[0]}`)
  }

  public async receiveBroadcast(message: TextMessage) {
    if(!message.content.startsWith('!raffle')) {
      return
    }
    this.server.logger.debug('Raffle module processing command')
    this.processRaffleCommand(message)
  }

  public receiveEvent(eventType: MessageIntents, event: any) {
    // Don't care
  }
}

export default RaffleModule
