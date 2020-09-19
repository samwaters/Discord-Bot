import * as https from "https"

export const httpsGet = (host: string, path: string = '/') => new Promise<string>((resolve, reject) => {
  const req = https.request({
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Trial Planner Bot (https://github.com/samwaters/trial-planner)'
    },
    host,
    method: 'GET',
    path,
    port: 443
  }, res => {
    let response: string = ''
    res.on('data', (data: string) => response += data)
    res.on('end', () => resolve(response))
    res.on('error', reject)
  })
  req.on('error', reject)
  req.end()
})
