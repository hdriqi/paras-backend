const JSBI = require('jsbi')

const REWARD_PER_USER = 100 * (10 ** 18)

class Reward {
  constructor(storage, near, ctl) {
    this.storage = storage
    this.near = near
    this.ctl = ctl
  }

  async disburse() {
    const self = this
    const allUsers = await this.ctl().activityPoint.get({})
    const activeUsers = allUsers.filter(user => {
      return user.point > 0
    }).map(user => {
      user.point = Math.min(user.point, 100)
      return user
    }).sort((a, b) => {
      return b.point - a.point
    }).sort((a, b) => {
      return new Date(a.createdAt) - new Date(b.createdAt)
    })

    const totalDisburse = activeUsers.length * REWARD_PER_USER

    const formula = (i, totalUser) => {
      return (Math.log10((totalUser + 1) - i) ** 2) / (i ** ((1 / 10) * (Math.abs(1 - (totalUser - i) / totalUser))))
    }

    let sum = 0
    for (let i = 0; i < activeUsers.length; i++) {
      sum += formula(i, activeUsers.length)
    }

    const k = 100 / sum
    const rewardsReceive = []

    for (let i = 0; i < activeUsers.length; i++) {
      const result = formula(i, activeUsers.length)
      const share = result * k /100
      rewardsReceive.push({
        userId: activeUsers[i].userId,
        point: activeUsers[i].point,
        share: share,
        tokens: share * totalDisburse
      })
    }
    await this.ctl().wallet.mint('paras::disburse', totalDisburse)
    await Promise.all(rewardsReceive.map(reward => {
      return new Promise(async (resolve, reject) => {
        await self.ctl().wallet.internalTransfer('paras::disburse', reward.userId, reward.tokens, `Disburse`)
        resolve()
      })
    }))
    await self.ctl().activityPoint.reset()
    console.log(rewardsReceive)
  }
}

module.exports = Reward