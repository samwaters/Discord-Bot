import { IConfig } from './config/config.interface'
import { IServer, Server } from './server'
import { LogLevel } from './utils/logger'
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'
import {IModule} from './module'

const readDir = promisify(fs.readdir)
const args = require('yargs')
  .default({
    intent: parseInt(process.env.INTENT) || 14103,
    loglevel: process.env.LOGLEVEL || LogLevel[LogLevel.INFO],
    modules: [
      'Echo'
    ],
    token: process.env.TOKEN
  })
  .argv

if(!args.token) {
  console.log('No token specified, please specify one with --token')
  process.exit(1)
}

const mode = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
const config: IConfig = require('./config/' + mode).config
const server: IServer = new Server(
  config,
  {token: args.token, intent: args.intent, logLevel: LogLevel[args.loglevel] as any}
  )

const loadModules = async () => {
  const modulePath = path.join(__dirname, 'modules')
  const modules = await readDir(modulePath)
  modules.forEach(file => {
    if(file.endsWith('.module.ts')) {
      const module = require(path.join(modulePath, file))
      const instantiatedModule: IModule = new module.default(server)
      if(args.modules.includes(instantiatedModule.name)) {
        server.registerModule(instantiatedModule)
      }
    }
  })
}

loadModules().then(
  () => {
    server.start()
  }
)
