class User {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async get(query) {
    try {
      const userList = await this.storage.get('user', query)
      return userList
    } catch (err) {
      return err
    }
  }

  async update(userId, payload) {
    const exist = await this.get({
      id: userId
    })

    if (exist.length === 0) {
      throw new Error('User not exist')
    }

    if (exist[0].id !== userId) {
      throw new Error('User can only be updated by owner')
    }

    const { value: updatedUserData } = await this.storage.db.collection('user').findOneAndUpdate({
      id: userId
    }, {
      $set: {
        imgAvatar: payload.imgAvatar,
        bio: payload.bio,
        updatedAt: new Date().getTime()
      }
    }, {
      returnOriginal: false
    })

    return updatedUserData
  }
}

module.exports = User