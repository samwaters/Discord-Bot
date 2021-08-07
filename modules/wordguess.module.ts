import {IModule} from '../module'
import {MessageDetails, MessageIntents, TextMessage} from '../gateway/messageTypes'
import {IServer} from '../server'
import {get} from './helpers/https'
import MessageHelper from './helpers/messagehelper'
import {UserInformation} from '../gateway/user'
const fs = require('fs').promises
const path = require('path')

interface WordGuessData {
    scrambledWord: string
    word: string
}

class WordGuessModule implements IModule {
    private levelMap = {
        easy: [4,5,6],
        medium: [7,8],
        hard: [9,10],
        difficult: [11,12,13],
        extreme: [14,15,16]
    }
    private server: IServer
    public name: string = 'WordGuess'
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

    private async createWordGuess(message: TextMessage, level: string) {
        const word: string = await this.getWord(level)
        const scrambledWord = word.split('').sort().join('')
        const messageDetails = await MessageHelper.sendMessage(
            message.channelId,
            scrambledWord
        )
        const parsedMessageDetails = JSON.parse(messageDetails)
        await this.server.redis.set(
            `squirtbot.wordguess.${parsedMessageDetails.channel_id}.${parsedMessageDetails.id}`,
            JSON.stringify({
                scrambledWord,
                word
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

    private async handleReply(message: TextMessage) {
        const wordGuessData = await this.server.redis.get(`squirtbot.wordguess.${message.channelId}.${message.referencedMessage.id}`)
        if(!wordGuessData) {
            this.server.logger.error(`Could not get squirtbot.wordguess.${message.channelId}.${message.referencedMessage.id}`)
            return
        }
        if(!/^[A-Za-z]+$/.test(message.content)) {
            // Invalid reply, delete
            await this.deleteMessage(message)
            return
        }
        const parsedWordGuessData: WordGuessData = JSON.parse(wordGuessData)
        const guess = message.content.toLowerCase()
        if(parsedWordGuessData.word === guess) {
            // Hooray
            await this.editMessage(message.referencedMessage, `Well done, the word was ${parsedWordGuessData.word}`)
        }
        // Now delete the original
        await this.deleteMessage(message)
    }

    public receiveBroadcast(message: TextMessage) {
        if(message.mentions.length === 1 && message.mentions[0].id === this.userInformation.id) {
            this.handleReply(message)
            return
        }
        if(!message.content.startsWith('!wordguess')) {
            return
        }
        this.server.logger.debug('WordGuess module processing command')
        const messageParts = message.content.split(' ')
        if(messageParts.length !== 2 || !Object.keys(this.levelMap).includes(messageParts[1])) {
            MessageHelper.sendMessage(message.channelId, 'Usage: !wordguess <level>\nLevel can be `easy`, `medium`, `hard`, `difficult`, `extreme`')
            return
        }
        this.createWordGuess(message, messageParts[1])
    }

    public receiveEvent(eventType: MessageIntents, event: any) {
        // Don't care about events
    }
}

export default WordGuessModule
