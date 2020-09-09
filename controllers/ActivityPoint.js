const basePoint = {
  createPost: 8,
  createPostMementoOwner: 3,
  createComment: 3,
  createMemento: 8,
  deletePost: 6,
  deleteComment: 2,
  redactPost: 4,
  depositMemento: 10,
  transfer: 1,
}

class ActivityPoint {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  _weightedRandom(min, max) {
    return Math.round(max / (Math.random() * max + min));
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
    const base = basePoint[payload.action]
    const point = base + this._weightedRandom(1, base)
    await this.storage.db.collection('activityPoint').insertOne({
      userId: userId,
      action: payload.action,
      type: 'add',
      point: parseInt(point),
      createdAt: new Date().getTime()
    })

    return true
  }

  async slash(userId, payload) {
    const base = basePoint[payload.action]
    const point = base + this._weightedRandom(0, base)
    await this.storage.db.collection('activityPoint').insertOne({
      userId: userId,
      action: payload.action,
      type: 'slash',
      point: parseInt(point),
      createdAt: new Date().getTime()
    })

    return true
  }
}

module.exports = ActivityPoint