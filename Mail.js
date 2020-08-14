const nodemailer = require('nodemailer')
const heml = require('heml')
const { prettyBalance } = require('./utils/common')
const templateVerifyEmail = require('./MailTemplate/verifyEmail')
const templateWalletEmail = require('./MailTemplate/walletEmail')
const templateNotifyEmail = require('./MailTemplate/notifyEmail')
const JSBI = require('jsbi')
const aws = require('aws-sdk')

const hemlOpts = {
  validate: 'soft',
  cheerio: {},
  juice: {},
  beautify: {},
  elements: []
}

class Mail {
  constructor() {
    this.transporter = null
    this.send = this.send.bind(this)
  }

  async init() {
    const SESConfig = new aws.SES({
      apiVersion: '2010-12-01',
      accessKeyId: process.env.SES_IAM_USER_KEY,
      secretAccessKey: process.env.SES_IAM_USER_SECRET,
      region: 'ap-southeast-1'
    })
    this.transporter = nodemailer.createTransport({
      SES: SESConfig
    })
  }

  send(data) {
    if(!this.transporter) {
      throw 'mail is not initialized'
    }
    return new Promise((resolve, reject) => {
      this.transporter.sendMail(data, (err) => {
        if(err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }

  async sendVerifyEmail({ link, email }) {
    const tmpl = templateVerifyEmail(link)
    const { html } = await heml(tmpl, hemlOpts)
    console.log(`verify mail send to ${email}`)
    this.send({
      from: `"Paras Team" <hello@paras.id>`,
      to: email,
      subject: `[Paras] Email Verification`,
      html: html
    })
  }

  async sendWalletEmail({ txList, email }) {
    const tmpl = templateWalletEmail(txList)
    const totalGain = txList.map(tx => JSBI.BigInt(tx.value)).reduce((a, b) => JSBI.add(a, b))
    const { html } = await heml(tmpl, hemlOpts)
    const subject = `[Paras] You've received ${prettyBalance(totalGain, 18, 4)} PAC`
    console.log(`wallet mail send to ${email}`)
    this.send({
      from: `"Paras Team" <hello@paras.id>`,
      to: email,
      subject: subject,
      html: html
    })
  }

  async sendNotificationEmail({ notifyList, email }) {
    const tmpl = templateNotifyEmail(notifyList)
    const { html } = await heml(tmpl, hemlOpts)
    const subject = `[Paras] You've ${notifyList.length} notifications`
    console.log(`notification mail send to ${email}`)
    this.send({
      from: `"Paras Team" <hello@paras.id>`,
      to: email,
      subject: subject,
      html: html
    })
  }
}

module.exports = Mail