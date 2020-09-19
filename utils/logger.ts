import * as chalk from 'chalk'

export enum LogLevel {
  ERROR,
  WARN,
  INFO,
  DEBUG
}

export interface ILogger {
  debug(message: string): void
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

export class Logger implements ILogger {
  private readonly logLevel: LogLevel
  constructor(level: LogLevel) {
    this.logLevel = level
  }

  public debug(message: string) {
    if(this.logLevel >= LogLevel.DEBUG) {
      console.log(chalk.magenta(`[${new Date().toLocaleString()}] ${message}`))
    }
  }

  public info(message: string) {
    if(this.logLevel >= LogLevel.INFO) {
      console.log(chalk.cyan(`[${new Date().toLocaleString()}] ${message}`))
    }
  }

  public warn(message: string) {
    if(this.logLevel >= LogLevel.WARN) {
      console.log(chalk.yellow(`[${new Date().toLocaleString()}] ${message}`))
    }
  }

  public error(message: string) {
    if(this.logLevel >= LogLevel.ERROR) {
      console.log(chalk.red(`[${new Date().toLocaleString()}] ${message}`))
    }
  }
}
