import {IServer} from '../../server'
import {httpsGet} from './https'

type ValueOf<T> = T[keyof T]

export const OpenTDBCategories = {
  ANY: 'any',
  GENERAL_KNOWLEDGE: 9,
  BOOKS: 10,
  FILM: 11,
  MUSIC: 12,
  MUSICAL_THEATRES: 13,
  TELEVISION: 14,
  VIDEO_GAMES: 15,
  BOARD_GAMES: 16,
  SCIENCE_NATURE: 17,
  COMPUTERS: 18,
  MATHEMATICS: 19,
  MYTHOLOGY: 20,
  SPORTS: 21,
  GEOGRAPHY: 22,
  HISTORY: 23,
  POLITICS: 24,
  ART: 25,
  CELEBRITIES: 26,
  ANIMALS: 27,
  VEHICLES: 28,
  COMICS: 29,
  GADGETS: 30,
  ANIME_MANGA: 31,
  CARTOON_ANIMATION: 32
}

export const OpenTDBDifficulty = {
  ANY: 'any',
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard'
}

export const OpenTDBType = {
  ANY: 'any',
  MULTIPLE_CHOICE: 'multiple',
  TRUE_FALSE: 'boolean'
}

export const OpenTDBEncoding = {
  DEFAULT: 'default',
  LEGACY: 'urlLegacy',
  URL: 'url3986',
  BASE64: 'base64'
}

export interface IOpenTDB {
  getQuestions: (
    amount: number,
    category: ValueOf<typeof OpenTDBCategories>,
    difficulty: ValueOf<typeof OpenTDBDifficulty>,
    questionType: ValueOf<typeof OpenTDBType>,
    encoding: ValueOf<typeof OpenTDBEncoding>
  ) => Promise<IOpenTDBQuestion[]>
}

export interface IOpenTDBQuestion {
  category: string
  type: string
  difficulty: string
  question: string
  correct_answer: string
  incorrect_answers: string[]
  shuffled_answers?: string[]
  shuffled_correct_answer?: number
}

export class OpenTDB implements IOpenTDB {
  private server: IServer

  constructor(server: IServer) {
    this.server = server
  }

  private urlBuilder(map: Record<string, string | number>) {
    return Object.keys(map).reduce(
      (prev, cur) => {
        if(map[cur] === 'any') return prev
        return `${prev}&${cur}=${map[cur]}`
      },
      ''
    ).substr(1)
  }

  public async getQuestions(
    amount: number = 10,
    category: ValueOf<typeof OpenTDBCategories> = OpenTDBCategories.ANY,
    difficulty: ValueOf<typeof OpenTDBDifficulty> = OpenTDBDifficulty.ANY,
    questiontype: ValueOf<typeof OpenTDBType> = OpenTDBType.ANY,
    encoding: ValueOf<typeof OpenTDBEncoding> = OpenTDBEncoding.URL
  ) {
    const questions = await httpsGet(
    'opentdb.com',
    `/api.php?${this.urlBuilder({
      amount,
      category,
      difficulty,
      questiontype,
      encoding
      })}`
    )
    const parsedQuestions = JSON.parse(questions)
    return parsedQuestions && parsedQuestions.response_code === 0 ? parsedQuestions.results : []
  }
}
