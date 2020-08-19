class Balance {
  constructor(storage, near) {
    this.storage = storage
    this.near = near
  }

  async get(userId) {
    try {
      const balance = await this.near.contract.balanceOf({
        tokenOwner: userId
      })
      return balance
    } catch (err) {
      console.log(err)
      throw err
    }
  }

  async piece(userId, postId, value) {
    const loadedAccount = this.near.accountsMap.get(userId)
    const latestBalance = await loadedAccount.contract.piecePost({
      postId: postId,
      value: value
    })
    return latestBalance
  }
}

module.exports = Balance