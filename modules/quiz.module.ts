import * as entities from 'html-entities'
import * as encodeurl from 'encodeurl'
import {IServer} from '../server'
import {IModule} from '../module'
import {MessageDetails, MessageIntents, TextMessage} from '../gateway/messageTypes'
import {UserInformation} from '../gateway/user'
import MessageHelper from './helpers/messagehelper'
import {
  IOpenTDB,
  IOpenTDBQuestion,
  OpenTDB,
  OpenTDBCategories,
  OpenTDBDifficulty,
  OpenTDBEncoding,
  OpenTDBType
} from './helpers/opentdb'
import {IReactionEvent} from '../gateway/events'

type ValueOf<T> = T[keyof T]

interface IQuizData {
  currentQuestion: number
  currentQuestionMessageId: number
  ownerId: string
  ownerName: string
  questionCount: string
  questionCategory: ValueOf<typeof OpenTDBCategories>
  questionDifficulty: ValueOf<typeof OpenTDBDifficulty>
  questionType: ValueOf<typeof OpenTDBType>
}

class QuizModule implements IModule {
  private opentdb: IOpenTDB
  private server: IServer
  private userInformation: UserInformation
  private EntityDecoder
  private UrlEncoder
  public name: string = 'Quiz'
  public version: string = '1.0.0'

  constructor(server: IServer) {
    this.server = server
    this.opentdb = new OpenTDB(server)
    this.EntityDecoder = new entities.XmlEntities()
    this.UrlEncoder = encodeurl
    this.server.redis.get('bot.user').then(
      (data: string) => this.userInformation = JSON.parse(data)
    )
  }

  private async checkAccess(message: TextMessage, command: string[], unstarted: boolean = false) {
    const quizData = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.details.${command[0]}`)
    if(!quizData) return false
    const parsedQuizData: IQuizData = JSON.parse(quizData)
    if(parsedQuizData.ownerId !== message.from.id) return false
    if(unstarted && parsedQuizData.currentQuestion > 0) return false
    return true
  }

  /**
   * Handle an answer to a question
   * @param quiz
   * @param question
   * @param quizName
   * @param event
   */
  private async handleAnswer(quiz: IQuizData, question: IOpenTDBQuestion, quizName: string, event: IReactionEvent) {
    const scoring = await this.server.redis.get(`quiz.${event.guild_id}.${event.channel_id}.scoring.${quizName}`)
    let parsedScoring = JSON.parse(scoring)
    const answerId = ['🇦', '🇧', '🇨', '🇩'].indexOf(event.emoji.name)
    parsedScoring = {
      ...parsedScoring,
      [quiz.currentQuestion]: {
        ...parsedScoring[quiz.currentQuestion],
        [event.member.user.username]: answerId === question.shuffled_correct_answer ? 1 : 0
      }
    }
    this.server.logger.warn(`Setting scoring to ${JSON.stringify(parsedScoring)}`)
    await this.server.redis.set(
      `quiz.${event.guild_id}.${event.channel_id}.scoring.${quizName}`,
      JSON.stringify(parsedScoring)
    )
  }

  /**
   * Handle Reaction Added - Handles a reaction to a message
   * @param event - The event data
   */
  private async handleReactionAdded(event: IReactionEvent) {
    if(this.userInformation.id === event.member.user.id) return
    const guildQuizMap = await this.server.redis.get(`quiz.${event.guild_id}.${event.channel_id}.map`)
    if(!guildQuizMap) return
    const parsedGuildQuizMap = JSON.parse(guildQuizMap)
    if(!Object.values(parsedGuildQuizMap).includes(event.message_id)) {
      this.server.logger.warn(`Reaction added, but not to one of ours - ${JSON.stringify(parsedGuildQuizMap)}`)
      return
    }
    const quizName = Object.keys(parsedGuildQuizMap).find(
      (key: string) => parsedGuildQuizMap[key] === event.message_id
    )
    const quizData = await this.server.redis.get(`quiz.${event.guild_id}.${event.channel_id}.details.${quizName}`)
    const quizQuestions = await this.server.redis.get(`quiz.${event.guild_id}.${event.channel_id}.questions.${quizName}`)
    if(!quizData || !quizQuestions) return false
    const parsedQuizData: IQuizData = JSON.parse(quizData)
    const parsedQuizQuestions: IOpenTDBQuestion[] = JSON.parse(quizQuestions)
    if(!parsedQuizQuestions[parsedQuizData.currentQuestion]) return
    const validEmojiReactions = parsedQuizQuestions[parsedQuizData.currentQuestion].type === 'boolean'
      ? ['🇦', '🇧']
      : ['🇦', '🇧', '🇨', '🇩']
    if(validEmojiReactions.includes(event.emoji.name)) {
      await this.handleAnswer(parsedQuizData, parsedQuizQuestions[parsedQuizData.currentQuestion], quizName, event)
    }
    const emojiToDelete = this.UrlEncoder(event.emoji.name)
    const deleteResult = await this.server.restAPI.request(
      `/channels/${event.channel_id}/messages/${event.message_id}/reactions/${emojiToDelete}/${event.member.user.id}`,
      'DELETE'
    )
    if(deleteResult && deleteResult.length > 0) {
      const parsedDeleteResult = JSON.parse(deleteResult)
      await MessageHelper.sendMessage(
        event.channel_id,
        `Error removing reaction: ${parsedDeleteResult.message}`
      )
    }
  }

  /**
   * New Quiz - Creates a new quiz
   * @param message - The message received
   * @param command - The command entered
   */
  private async newQuiz(message: TextMessage, command: string[]) {
    // 0=name, 1=amount, 2=category, 3=difficulty, 4=type
    command[1] = command[1] || '10'
    command[2] = command[2] || OpenTDBCategories.ANY
    command[3] = command[3] || OpenTDBDifficulty.ANY
    command[4] = command[4] || OpenTDBType.ANY
    if(
      !/^\d+$/.test(command[1]) ||
      !Object.values(OpenTDBCategories).includes(command[2]) ||
      !Object.values(OpenTDBDifficulty).includes(command[3]) ||
      !Object.values(OpenTDBType).includes(command[4]) ||
      parseInt(command[1]) < 1 ||
      parseInt(command[1]) > 25
    ) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: new <amount> <category> <difficulty> <type>')
      return
    }
    const existingQuestion = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.details.${command[0]}`)
    if(existingQuestion) {
      await MessageHelper.sendMessage(message.channelId, `Quiz ${command[0]} already exists`)
      return
    }
    let questions: IOpenTDBQuestion[] = await this.opentdb.getQuestions(
      parseInt(command[1]),
      OpenTDBCategories[command[2]],
      OpenTDBDifficulty[command[3]],
      OpenTDBType[command[4]],
      OpenTDBEncoding.URL
    )
    questions = questions.map(question => {
      let answers = question.incorrect_answers.map(answer => this.EntityDecoder.decode(answer))
      answers.push(this.EntityDecoder.decode(question.correct_answer))
      answers = this.randomizeArray(answers)
      return {
        ...question,
        question: this.EntityDecoder.decode(question.question),
        shuffled_answers: answers,
        shuffled_correct_answer: answers.indexOf(question.correct_answer)
      }
    })

    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.details.${command[0]}`,
      JSON.stringify({
        currentQuestion: -1,
        currentQuestionMessageId: -1,
        ownerId: message.from.id,
        ownerName: message.from.name,
        questionCount: command[1],
        questionCategory: command[2],
        questionDifficulty: command[3],
        questionType: command[4]
      })
    )
    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.questions.${command[0]}`,
      JSON.stringify(questions)
    )
    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.scoring.${command[0]}`,
      JSON.stringify({})
    )
    await MessageHelper.sendMessage(message.channelId, `Quiz ${command[0]} created successfully`)
  }

  /**
   * Next Question - Advances to the next question in the quiz
   * @param message - The message received
   * @param command - The command entered
   */
  private async nextQuestion(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, `Usage: next <name>`)
      return
    }
    const access = await this.checkAccess(message, command)
    if(!access) {
      await MessageHelper.sendMessage(message.channelId, 'You do not have access to this quiz')
      return
    }
    const quizData = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.details.${command[0]}`)
    const parsedQuizData: IQuizData = JSON.parse(quizData)
    const quizQuestions = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.questions.${command[0]}`)
    const parsedQuizQuestions: IOpenTDBQuestion[] = JSON.parse(quizQuestions)
    if(!parsedQuizQuestions[parsedQuizData.currentQuestion + 1]) {
      await MessageHelper.sendMessage(message.channelId, 'There is no next question!')
      return
    }
    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.details.${command[0]}`,
      JSON.stringify({...parsedQuizData, currentQuestion: parsedQuizData.currentQuestion + 1})
    )
    parsedQuizData.currentQuestion++
    const currentQuestion: IOpenTDBQuestion = parsedQuizQuestions[parsedQuizData.currentQuestion]
    let questionStr = currentQuestion.question + '\n\n'
    if(currentQuestion.type === 'boolean') {
      questionStr += ':regional_indicator_a: True\n:regional_indicator_b: False'
    } else {
      currentQuestion.shuffled_answers.forEach((answer, idx) => {
        questionStr += `:regional_indicator_${String.fromCharCode(97 + idx)}: ${answer}\n`
      })
    }

    const messageDetails = await MessageHelper.sendMessage(
      message.channelId,
      questionStr
    )
    const messageData: MessageDetails = JSON.parse(messageDetails)
    MessageHelper.addMultipleReactions(
      messageData.channel_id,
      messageData.id,
      currentQuestion.type === 'boolean'
        ? ['🇦', '🇧']
        : ['🇦', '🇧', '🇨', '🇩']
    )
    let guildQuizMap = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.map`)
    if(!guildQuizMap) guildQuizMap = '{}'
    const parsedGuildQuizMap = JSON.parse(guildQuizMap)
    parsedGuildQuizMap[command[0]] = messageData.id
    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.map`,
      JSON.stringify(parsedGuildQuizMap)
    )
  }

  /**
   * End Quiz - End the quiz
   * @param message - The message received
   * @param command - The command entered
   */
  private endQuiz(message: TextMessage, command: string[]) {

  }

  /**
   * Print Help - Prints help
   * @param message - The message received
   */
  private printHelp(message: TextMessage) {
    MessageHelper.sendMessage(
      message.channelId,
      ``
    )
  }

  /**
   * Randomize an array - Shuffles items into a random order
   * @param array - The array to shuffle
   */
  private randomizeArray(array: string[]) {
    let currentIndex = array.length, temporaryValue, randomIndex
    while (currentIndex !== 0) {
      randomIndex = Math.floor(Math.random() * currentIndex)
      currentIndex -= 1
      temporaryValue = array[currentIndex]
      array[currentIndex] = array[randomIndex]
      array[randomIndex] = temporaryValue
    }
    return array
  }

  /**
   * Start Quiz - Starts a quiz
   * @param message - The message received
   * @param command - The command entered
   */
  private async startQuiz(message: TextMessage, command: string[]) {
    if(command.length !== 1) {
      await MessageHelper.sendMessage(message.channelId, 'Usage: startQuiz <name>')
      return
    }
    const access = await this.checkAccess(message, command)
    if(!access) {
      await MessageHelper.sendMessage(message.channelId, 'You do not have access to this quiz')
      return
    }
    const quizData = await this.server.redis.get(`quiz.${message.guildId}.${message.channelId}.details.${command[0]}`)
    const parsedQuizData: IQuizData = JSON.parse(quizData)
    await this.server.redis.set(
      `quiz.${message.guildId}.${message.channelId}.details.${command[0]}`,
      JSON.stringify({
        ...parsedQuizData,
        currentQuestion: -1
      })
    )
    await this.nextQuestion(message, command)
  }

  /**
   * Receive Broadcast - Message entrypoint from server
   * @param message - The message received
   */
  public receiveBroadcast(message: TextMessage) {
    if(message.mentions.length !== 1 || message.mentions[0].id !== this.userInformation.id)
      return
    // Take out the mention, collapse spaces and trim
    const content: string = message.content
      .replace(`<@!${message.mentions[0].id}>`, '')
      .replace(/\s+/, ' ')
      .trim()
    const command = content.split(' ')
    switch(command[0]) {
      case 'end':
        this.endQuiz(message, command.slice(1))
        break
      case 'help':
        this.printHelp(message)
        break
      case 'new':
        this.newQuiz(message, command.slice(1))
        break
      case 'next':
        this.nextQuestion(message, command.slice(1))
        break
      case 'start':
        this.startQuiz(message, command.slice(1))
        break
      default:
        MessageHelper.sendMessage(message.channelId, `Unknown command ${command[0]}`)
    }
  }

  /**
   * Receive Event - Event entrypoint from server
   * @param eventType - Event type
   * @param event - Event data
   */
  public receiveEvent(eventType: MessageIntents, event: any) {
    switch(eventType) {
      case MessageIntents.MESSAGE_REACTION_ADD:
        this.handleReactionAdded(event)
        break
      case MessageIntents.MESSAGE_REACTION_REMOVE:
      case MessageIntents.MESSAGE_REACTION_REMOVE_ALL:
      case MessageIntents.MESSAGE_REACTION_REMOVE_EMOJI:
      default:
        this.server.logger.info(`Quiz Module: Unknown event ${eventType}`)
    }
  }
}

export default QuizModule
