const basePoint = {
  createPost: 8,
  createPostMementoOwner: 3,
  createComment: 3,
  createMemento: 8,
  depositMemento: 10,
  transfer: 1,
  deletePost: 10,
  deleteComment: 4,
  redactPost: 3,
}

class ActivityPoint {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  _weightedRandom(min, max) {
    return Math.round(max / (Math.random() * max + min))
  }

  async reset() {
    await this.storage.db.collection('activityPoint').deleteMany({})
    return true
  }

  async getByUserId(userId) {
    const user = await this.get({
      userId: userId
    })
    if (activityList.length === 0) {
      return 0
    }
    return user[0].point
  }

  async get(query) {
    try {
      const activityList = await this.storage.get('activityPoint', query)
      return activityList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async add(userId, payload) {
    const skip = userId.split('::')
    if (skip.length > 0 && skip[0] === 'paras') {
      return true
    }
    const base = basePoint[payload.action]
    const point = base + this._weightedRandom(1, base)
    await this.storage.db.collection('activityHistory').insertOne({
      userId: userId,
      action: payload.action,
      type: 'add',
      point: parseInt(point),
      createdAt: new Date().getTime()
    })

    const currentPoint = await this.storage.db.collection('activityPoint').findOne({
      userId: userId
    })
    const newPoint = currentPoint ? currentPoint.point + point : point
    await this.storage.db.collection('activityPoint').findOneAndUpdate({
      userId: userId
    }, {
      $set: {
        point: parseInt(newPoint)
      }
    }, {
      upsert: true
    })

    return true
  }

  async slash(userId, payload) {
    const base = basePoint[payload.action]
    const point = base + this._weightedRandom(0, base)
    const currentPoint = await this.storage.db.collection('activityPoint').findOne({
      userId: userId
    })
    if (currentPoint && currentPoint.point > 0) {
      await this.storage.db.collection('activityHistory').insertOne({
        userId: userId,
        action: payload.action,
        type: 'slash',
        point: parseInt(point),
        createdAt: new Date().getTime()
      })
      const newPoint = Math.max(currentPoint.point - point, 0) 
      await this.storage.db.collection('activityPoint').findOneAndUpdate({
        userId: userId
      }, {
        $set: {
          point: parseInt(newPoint)
        }
      }, {
        upsert: true
      })
    }

    return true
  }
}

module.exports = ActivityPoint