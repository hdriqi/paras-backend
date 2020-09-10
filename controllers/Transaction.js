class Transaction {
  constructor(state, storage) {
    this.state = state
    this.storage = storage
  }

  async get(query) {
    const txList = await this.storage.get('transaction', query, [{
      col: 'fromUser',
      key: 'from',
      targetCol: 'user',
      targetKey: 'id'
    }, {
      col: 'toUser',
      key: 'to',
      targetCol: 'user',
      targetKey: 'id'
    }])
    return txList
  }

  async getById(id, skip = 0, limit = 5) {
    const embed = [{
      col: 'fromUser',
      key: 'from',
      targetCol: 'user',
      targetKey: 'id'
    }, {
      col: 'toUser',
      key: 'to',
      targetCol: 'user',
      targetKey: 'id'
    }]
    const data = await this.storage.db.collection('transaction').find({
      $or: [
        {
          from: id
        },
        {
          to: id
        }
      ]
    }, {
      projection: {
        _id: 0
      }
    })
      .sort({
        createdAt: -1
      })
      .skip(parseInt(skip))
      .limit(parseInt(limit))

    const arr = data.toArray()
    const iter = (await arr).map(x => x)
    const result = []
    for await (const d of iter) {
      if (embed &&  embed.length > 0) {
        for (const e of embed) {
          d[e.col] = await this.storage.db.collection(e.targetCol).findOne({
            [e.targetKey]: d[e.key]
          })
        }
      }
      result.push(d)
    }
    return result
  }
}

module.exports = Transaction