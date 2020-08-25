const { parseNearAmount } = require('near-api-js/lib/utils/format')

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

  async transfer(userId, targetUserId, value, msg = '') {
    const loadedAccount = this.near.accountsMap.get(userId)
    await loadedAccount.contract.transfer({
      to: targetUserId,
      tokens: value,
      msg: msg
    })
    const latestBalance = this.get(userId)
    return latestBalance
  }

  async transferNear(userId, receiverId, value) {
    const loadedAccount = this.near.accountsMap.get(userId)
    await loadedAccount.contract.account.sendMoney(receiverId, value)
    return true
  }
}

module.exports = Balance