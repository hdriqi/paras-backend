const MongoClient = require('mongodb').MongoClient
const qpm = require('query-params-mongo')
const ipfsClient = require('ipfs-http-client')
const { readFileSync, unlinkSync } = require('fs')
const processQuery = qpm()

class Storage {
  constructor() {
    const uri = `${process.env.MONGO_URL}?retryWrites=true&w=majority`
    this.client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true })
    this.ipfs = ipfsClient({ host: 'ipfs-api.paras.id', port: '443', protocol: 'https' })
    this.ready = null
  }

  async init() {
    try {
      await this.client.connect()
      this.db = this.client.db(process.env.DB_NAME)
      this.ready = true
      this.kv = this.db.collection('kv')
      this.feeds = this.db.collection('feeds')
      this.verifications = this.db.collection('verifications')
    } catch (err) {
      console.log(err)
    }
  }

  async get(collection, q, embed) {
    var query = processQuery(q)
    const data = await this.db.collection(collection).find(query.filter, {
      projection: {
        _id: 0
      }
    })
      .sort(query.sort)
      .skip(query.skip || 0)
      .limit(query.limit || 10)

    const arr = data.toArray()
    const iter = (await arr).map(x => x)
    const result = []
    for await (const d of iter) {
      if (embed && embed.length > 0) {
        for (const e of embed) {
          d[e.col] = await this.db.collection(e.targetCol).findOne({
            [e.targetKey]: d[e.key]
          })
        }
      }
      result.push(d)
    }
    return result
  }

  async upload(input, type = 'file') {
    let result = null
    if (type === 'url') {
      result = await this.ipfs.add(ipfsClient.urlSource(input))
    }
    else {
      result = await this.ipfs.add({
        content: readFileSync(input.path)
      })
      unlinkSync(input.path)
    }
    return {
      url: result.cid.toString(),
      type: 'ipfs'
    }
  }
}

module.exports = Storage