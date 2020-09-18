const { prettyBalance } = require('../../utils/common')

class NotificationWallet {
  constructor(storage) {
    this.storage = storage
  }

  // id: shortid.generate(),
  //     from: userId,
  //     to: receiverId,
  //     value: value,
  //     msg: msg,
  //     createdAt: new Date().getTime()
  async transfer(data, send) {
    const splitMsg = data.msg.split('::')
    if (splitMsg.length > 0 && splitMsg[0] === 'System') {
      if (splitMsg[1] === 'Piece' || splitMsg[1] === 'PieceSupporter') {
        const payload = {
          screen: 'post',
          id: splitMsg[2]
        }
        const msg = splitMsg[1] === 'Piece' ? `You've receive ${prettyBalance(data.value)} PAC via Piece by ${data.from}` : `You've receive ${prettyBalance(data.value)} PAC via supporter payout`
        const newNotification = {
          payload: payload,
          message: msg,
          userId: data.to,
          createdAt: new Date().getTime()
        }
        await this.storage.db.collection('notification').insertOne(newNotification)
        console.log(`send notification to ${data.to} with message ${newNotification.message}`)
        try {
          send(data.to, payload, {
            title: 'Paras',
            icon: 'ic_launcher',
            body: newNotification.message
          })
        } catch (err) {
          console.log(err)
        }
      }
      if (splitMsg[1] === 'RewardDisburse') {
        const payload = {
          screen: 'walletHistory',
          id: data.from
        }
        const newNotification = {
          payload: payload,
          message: `You've receive ${prettyBalance(data.value)} PAC via Daily Reward`,
          userId: data.to,
          createdAt: new Date().getTime()
        }
        await this.storage.db.collection('notification').insertOne(newNotification)
        console.log(`send notification to ${data.to} with message ${newNotification.message}`)
        try {
          send(data.to, payload, {
            title: 'Paras',
            icon: 'ic_launcher',
            body: newNotification.message
          })
        } catch (err) {
          console.log(err)
        }
      }
    }
    else {
      const payload = {
        screen: 'walletHistory',
        id: data.from
      }
      const newNotification = {
        payload: payload,
        message: `You've receive ${prettyBalance(data.value)} PAC from ${data.from}`,
        userId: data.to,
        createdAt: new Date().getTime()
      }
      await this.storage.db.collection('notification').insertOne(newNotification)
      console.log(`send notification to ${data.to} with message ${newNotification.message}`)
      try {
        send(data.to, payload, {
          title: 'Paras',
          icon: 'ic_launcher',
          body: newNotification.message
        })
      } catch (err) {
        console.log(err)
      }
    }
  }
}

module.exports = NotificationWallet