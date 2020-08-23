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
    const loadedAccount = this.near.accountsMap.get(userId)
    const newComment = await loadedAccount.contract.createComment({
      postId: postId,
      body: body
    })
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