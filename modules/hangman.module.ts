import {IModule} from '../module'
import {MessageDetails, MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'
import {UserInformation} from '../gateway/user'
const fs = require('fs').promises
const path = require('path')

interface HangmanData {
    complete: boolean
    guesses: string[]
    word: string
}

class HangmanModule implements IModule {
    private levelMap = {
        easy: [4,5,6],
        medium: [7,8],
        hard: [9,10],
        difficult: [11,12,13],
        extreme: [14,15,16]
    }
    private maximumGuesses: number = 8
    private server: IServer
    public name: string = 'Hangman'
    private userInformation: UserInformation
    public version: string = '1.0.0'

    constructor(server: IServer) {
        this.server = server
        this.server.redis.get('bot.user').then(
            (data: string) => this.userInformation = JSON.parse(data)
          )
    }

    private async getWord(level: string) {
        const levelRange = this.levelMap[level]
        const length: number = Math.floor(Math.random() * ([...levelRange].pop() - levelRange[0] + 1)) + levelRange[0]
        const words = await fs.readFile(path.join(__dirname, '..', 'data', 'words', `${length}letter.words`), 'utf-8')
        const wordArr: string[] = words.split('\n')
        return wordArr[Math.floor(Math.random() * wordArr.length)].toLowerCase()
    }

    private async createHangman(message: TextMessage, level: string) {
        const word: string = await this.getWord(level)
        const messageDetails = await MessageHelper.sendMessage(
            message.channelId,
            `${new Array(word.length).fill('?').join(' ')}\nGuesses Left: ${this.maximumGuesses}`
        )
        const parsedMessageDetails = JSON.parse(messageDetails)
        await this.server.redis.set(
            `squirtbot.hangman.${parsedMessageDetails.channel_id}.${parsedMessageDetails.id}`,
            JSON.stringify({
                complete: false,
                guesses: [],
                word: word
            })
        )
    }

    private async deleteMessage(message: TextMessage) {
        await this.server.restAPI.request(`/channels/${message.channelId}/messages/${message.id}`, 'DELETE')
    }

    private async editMessage(message: TextMessage, newMessage: string) {
        await this.server.restAPI.request(
            `/channels/${message.channelId}/messages/${message.id}`,
            'PATCH',
            JSON.stringify({content: newMessage})
        )
    }

    private getHangmanMessage(hangmanData: HangmanData) {
        const wordArr = hangmanData.word.split('')
        const invalidGuesses: string[] = hangmanData.guesses.filter(l => !wordArr.includes(l))
        const validGuesses: string[] = hangmanData.guesses.filter(l => wordArr.includes(l))
        const word: string = wordArr.map(l => validGuesses.includes(l) ? l : '?').join(' ')

        return {
            complete: word.indexOf('?') === -1,
            invalidGuesses,
            originalWord: hangmanData.word,
            word
        }
    }

    private async handleReply(message: TextMessage) {
        const hangmanData = await this.server.redis.get(`squirtbot.hangman.${message.channelId}.${message.referencedMessage.id}`)
        if(!hangmanData) {
            this.server.logger.error(`Could not get squirtbot.hangman.${message.channelId}.${message.referencedMessage.id}`)
            return
        }
        if(!/^[A-Za-z]$/.test(message.content)) {
            // Invalid reply, delete
            await this.deleteMessage(message)
            return
        }
        const parsedHangmanData: HangmanData = JSON.parse(hangmanData)
        const letter = message.content.toLowerCase()
        if(parsedHangmanData.guesses.includes(letter) || parsedHangmanData.complete) {
            // Already guessed
            await this.deleteMessage(message)
            return
        }
        // Add the letter to the guesses and save it
        parsedHangmanData.guesses.push(letter)
        const hangmanMessage = this.getHangmanMessage(parsedHangmanData)
        parsedHangmanData.complete = hangmanMessage.complete
        this.server.redis.set(
            `squirtbot.hangman.${message.channelId}.${message.referencedMessage.id}`,
            JSON.stringify(parsedHangmanData)
        )
        this.updateMessage(message.referencedMessage, hangmanMessage)
        // Now delete the original
        await this.deleteMessage(message)
    }

    private async updateMessage(message: TextMessage, hangmanMessage) {
        if(this.maximumGuesses - hangmanMessage.invalidGuesses.length <= 0) {
            await this.editMessage(message, `Game Over! The word was ${hangmanMessage.originalWord}`)
            return
        }
        if(hangmanMessage.complete) {
            await this.editMessage(message, `Well Done! The word was ${hangmanMessage.originalWord}`)
            return
        }

        await this.editMessage(message, `${hangmanMessage.word}\nGuessed: ${hangmanMessage.invalidGuesses.join(' ')}\nGuesses Left: ${this.maximumGuesses - hangmanMessage.invalidGuesses.length}`)
    }

    public receiveBroadcast(message: TextMessage) {
        if(message.mentions.length === 1 && message.mentions[0].id === this.userInformation.id) {
            this.handleReply(message)
            return
        }
        if(!message.content.startsWith('!hangman')) {
            return
        }
        this.server.logger.debug('Hangman module processing command')
        const messageParts = message.content.split(' ')
        if(messageParts.length !== 2 || !Object.keys(this.levelMap).includes(messageParts[1])) {
            MessageHelper.sendMessage(message.channelId, 'Usage: !hangman <level>\nLevel can be `easy`, `medium`, `hard`, `difficult`, `extreme`')
            return
        }
        this.createHangman(message, messageParts[1])
    }

    public receiveEvent(eventType: MessageIntents, event: any) {
        // Don't care about events
    }
}

export default HangmanModule
