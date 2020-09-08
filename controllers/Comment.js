const shortid = require('shortid')

class Comment {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  async get(query) {
    try {
      const commentList = await this.storage.get('comment', query, [{
        col: 'user',
        key: 'owner',
        targetCol: 'user',
        targetKey: 'id'
      }])

      return commentList
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async create(userId, postId, body) {
    const id = shortid.generate()
    const newCommentData = {
      id: id,
      postId: postId,
      body: body,
      owner: userId,
      createdAt: new Date().getTime()
    }
    const newData = await this.storage.db.collection('comment').insertOne(newCommentData)
    const newComment = newData.ops[0]

    const user = await this.storage.db.collection('user').findOne({
      id: userId
    })
    newComment.user = user

    return newComment
  }

  async delete(userId, commentId) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const deletedComment = await loadedAccount.contract.deleteComment({
      id: commentId
    })
    return deletedComment
  }
}

module.exports = Comment