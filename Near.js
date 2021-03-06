const { Contract, KeyPair, connect } = require('near-api-js')
const { join } = require('path')
const { InMemoryKeyStore, MergeKeyStore, UnencryptedFileSystemKeyStore } = require('near-api-js').keyStores
const { parseNearAmount } = require('near-api-js').utils.format

const config = require('./config')(process.env.NODE_ENV || 'development')

const contractConfig = {
  viewMethods: [
    'getUserById',
    'getMementoById',
    'name',
    'symbol',
    'decimals',
    'balanceOf',
    'allowance',
    'getBalance'
  ],
  // Change methods can modify the state, but you don't receive the returned value when called
  changeMethods: [
    'createMemento',
    'updateMemento',
    'archiveMemento',
    'unarchiveMemento',
    'deleteMemento',
    'createPost',
    'transmitPost',
    'editPost',
    'deletePost',
    'redactPost',
    'toggleFollow',
    'createUser',
    'updateUser',
    'createComment',
    'deleteComment',
    'init',
    'transfer',
    'approve',
    'transferFrom',
    'piecePost'
  ],
}

class Near {
  constructor() {
    this.ctx = null
    this.masterAccount = null
    this.accountMap = new Map()
  }

  async init() {
    if (!process.env.ROOT_ACCOUNT) {
      throw "[env] ROOT_ACCOUNT not found"
    }
    if (!process.env.CONTRACT_ACCOUNT) {
      throw "[env] CONTRACT_ACCOUNT not found"
    }
    const rootAccount = JSON.parse(process.env.ROOT_ACCOUNT)
    const contractAccount = JSON.parse(process.env.CONTRACT_ACCOUNT)
    const keyStore = new InMemoryKeyStore()
    
    const rootKeyPair = KeyPair.fromString(rootAccount.secret_key || rootAccount.private_key)
    await keyStore.setKey(config.networkId, rootAccount.account_id, rootKeyPair)

    const contractKeyPair = KeyPair.fromString(contractAccount.secret_key || contractAccount.private_key)
    await keyStore.setKey(config.networkId, contractAccount.account_id, contractKeyPair)

    const near = await connect({
      deps: {
        keyStore: keyStore
      },
      ...config
    })
    this.ctx = near
    this.masterAccount = await near.account(rootAccount.account_id)
    this.contractAccount = await near.account(contractAccount.account_id)
    this.keyStore = keyStore
  }

  async checkAccount(accountId) {
    return new Promise(async (resolve) => {
      let account = null
      try {
        account = await this.ctx.account(accountId)
      } catch (err) {
        // console.log(err)
      }
      resolve(account)
    })
  }

  async loadAccount({ userId, secretKey }) {
    const accId = userId
    const accExist = await this.checkAccount(accId)
    if (!accExist) {
      throw new Error(`Account ${accId} not exist`)
    }
    const keyPair = KeyPair.fromString(secretKey)
    await this.keyStore.setKey(config.networkId, accId, keyPair)
    const contract = new Contract(accExist, `contract-beta-dev.paras.testnet`, contractConfig)

    this.accountMap.set(accId, {
      publicKey: accExist.public_key,
      contract: contract
    })

    return true
  }

  async createAccount({ userId, secretKey }) {
    const newAccId = userId
    const accExist = await this.checkAccount(newAccId)
    if (accExist) {
      throw new Error(`Account ${newAccId} already exist`)
    }
    const keyPair = KeyPair.fromString(secretKey)
    const newAccount = await this.masterAccount.createAccount(newAccId, keyPair.publicKey.toString(), parseNearAmount('0.1'))
    await this.loadAccount({ userId, secretKey })
    return newAccount
  }

  async deployContract() {
    console.log('Setting up and deploying contract')
    const contractPath = join(process.cwd(), 'out/main.wasm')
    await this.contractAccount.deployContract(require('fs').readFileSync(contractPath))
    console.log(`Contract ${this.contractAccount.accountId} deployed`)
  }
}

module.exports = Near

// const init = async () => {
//   if (!process.env.ROOT_KEY) {
//     throw "ROOT_KEY not found"
//   }
//   const rootKey = JSON.parse(process.env.ROOT_KEY)
//   const x = nearAPI.KeyPair.fromString(rootKey.secret_key || rootKey.private_key)
//   console.log(x)
//   // const near = await connect({
//   //   deps: nearAPI.KeyPair.fromString(creatorKeyJson.secret_key || creatorKeyJson.private_key),
//   //   masterAccount: creatorKeyJson && creatorKeyJson.account_id,
//   //   nodeUrl: process.env.NODE_URL
//   // })
// }

// const registerAccount = async ({ email, username, privateKey }) => {
//   const masterAccountName = `reddit-token-contract-${Date.now()}`
//   const contractName = masterAccountName
//   const keyPair = KeyPair.from
//   await keyStore.setKey(config.networkId, masterAccountName, keyPair)
//   const masterAccount = await near.createAccount(masterAccountName, keyPair.publicKey.toString())
//   await masterAccount.deployContract(require('fs').readFileSync('./out/main.wasm'))

//   const masterAccountAcc = await near.account(masterAccountName)
//   const masterAccountContract = new Contract(masterAccountAcc, contractName, contractConfig)

//   ownerAccount = {
//     accountId: masterAccountName,
//     publicKey: '1' + keyPair.publicKey.toString().substring(8),
//     contract: masterAccountContract
//   }

//   accountsMap.set(ownerAccount.accountId, {
//     publicKey: ownerAccount.publicKey,
//     contract: ownerAccount.contract,
//     privateKey: keyPair.secretKey
//   })

//   await masterAccountContract.init({ totalSupply: '20000' })
//   const response = await masterAccountContract.balanceOf({ tokenOwner: ownerAccount.publicKey })
//   console.log("balance:" + JSON.stringify(response))

//   console.log("https://explorer.testnet.near.org/accounts/" + masterAccountName)

//   console.log('Creating accounts')
//   console.time('create accounts')
//   const accountPrefix = `nrb-user-${Date.now()}`
//   for (let i = 0; i < numAccounts; i++) {
//     const accountId = `${accountPrefix}-${i}`
//     const keyPair = KeyPair.fromRandom('ed25519')
//     await keyStore.setKey(config.networkId, accountId, keyPair)
//     await masterAccount.createAccount(accountId, keyPair.publicKey, parseNearAmount('0.1'))
//     const account = await near.account(accountId)
//     const contract = new Contract(account, contractName, contractConfig)

//     accountsMap.set(accountId, {
//       publicKey: '1' + keyPair.publicKey.toString().substring(8),
//       contract: contract,
//       privateKey: keyPair.secretKey
//     })

//     process.stdout.write('-')
//   }
// }

// let ownerAccount
// let accountsMap = new Map()

// async function loadAccounts(accounts) {
//   let contractName
//   let masterPublicKey

//   // keystore instance
//   let keyStore = new InMemoryKeyStore()

//   accounts.forEach(async acc => {
//     if (acc.user_type == 'owner') {
//       console.log('owner -> ' + JSON.stringify(acc))
//       contractName = acc.account_id
//       masterPublicKey = acc.public_key
//     }
//     // generate a new keypair from privateKey
//     const keypair = KeyPair.fromString("ed25519:" + acc.private_key)

//     // await keyStore.setKey(nearConfig.networkId, account.name, random);
//     await keyStore.setKey(config.networkId, acc.account_id, keypair)
//   })

//   if (!contractName) {
//     console.error('Invalid contractName')
//     return false
//   }

//   const near = await connect({ ...config, keyStore })

//   const masterAccountAcc = await near.account(contractName)
//   const masterAccountContract = new Contract(masterAccountAcc, contractName, contractConfig)

//   ownerAccount = {
//     accountId: contractName,
//     publicKey: masterPublicKey,
//     contract: masterAccountContract
//   }

//   accountsMap.set(ownerAccount.accountId, {
//     publicKey: ownerAccount.publicKey,
//     contract: ownerAccount.contract
//   })

//   const response = await masterAccountContract.totalSupply({})
//   console.log("balance:" + JSON.stringify(response))


//   console.log('Loading accounts')
//   accounts.forEach(async acc => {
//     if (acc.user_type != 'owner') {
//       const account = await near.account(acc.account_id)
//       const contract = new Contract(account, contractName, contractConfig)

//       accountsMap.set(acc.account_id, {
//         publicKey: acc.public_key,
//         contract: contract
//       })
//     }
//   })
//   console.log('Loading accounts done')
// }

// async function createAccounts(numAccounts) {
//   const keyStore = new MergeKeyStore([
//     new InMemoryKeyStore(),
//     new UnencryptedFileSystemKeyStore('./neardev')
//   ])
//   const near = await connect({ ...config, keyStore })

//   console.log('Setting up and deploying contract')
//   const masterAccountName = `reddit-token-contract-${Date.now()}`
//   const contractName = masterAccountName
//   const keyPair = KeyPair.fromRandom('ed25519')
//   await keyStore.setKey(config.networkId, masterAccountName, keyPair)
//   const masterAccount = await near.createAccount(masterAccountName, keyPair.publicKey.toString())
//   await masterAccount.deployContract(require('fs').readFileSync('./out/main.wasm'))

//   const masterAccountAcc = await near.account(masterAccountName)
//   const masterAccountContract = new Contract(masterAccountAcc, contractName, contractConfig)

//   ownerAccount = {
//     accountId: masterAccountName,
//     publicKey: '1' + keyPair.publicKey.toString().substring(8),
//     contract: masterAccountContract
//   }

//   accountsMap.set(ownerAccount.accountId, {
//     publicKey: ownerAccount.publicKey,
//     contract: ownerAccount.contract,
//     privateKey: keyPair.secretKey
//   })

//   await masterAccountContract.init({ totalSupply: '20000' })
//   const response = await masterAccountContract.balanceOf({ tokenOwner: ownerAccount.publicKey })
//   console.log("balance:" + JSON.stringify(response))

//   console.log("https://explorer.testnet.near.org/accounts/" + masterAccountName)

//   console.log('Creating accounts')
//   console.time('create accounts')
//   const accountPrefix = `nrb-user-${Date.now()}`
//   for (let i = 0; i < numAccounts; i++) {
//     const accountId = `${accountPrefix}-${i}`
//     const keyPair = KeyPair.fromRandom('ed25519')
//     await keyStore.setKey(config.networkId, accountId, keyPair)
//     await masterAccount.createAccount(accountId, keyPair.publicKey, parseNearAmount('0.1'))
//     const account = await near.account(accountId)
//     const contract = new Contract(account, contractName, contractConfig)

//     accountsMap.set(accountId, {
//       publicKey: '1' + keyPair.publicKey.toString().substring(8),
//       contract: contract,
//       privateKey: keyPair.secretKey
//     })

//     process.stdout.write('-')
//   }
//   console.timeEnd('create accounts')

//   console.log('Creating accounts done')

//   return accountsMap
// }

// async function callContractMethod(contract, methodName, args) {
//   const rawResult = await contract.account.functionCall(contract.contractId, methodName, args)
//   console.log("callContractMethod[" + methodName + "] tx: " + JSON.stringify(rawResult.transaction.hash))

//   return rawResult.transaction.hash
// }

// async function getBalances() {
//   console.log('get balances')
//   for (const [accountId, account] of accountsMap.entries()) {
//     try {
//       const response = await account.contract.balanceOf({ tokenOwner: account.publicKey })
//       console.log("balance:" + JSON.stringify(response))
//     } catch (e) {
//       console.error(e)
//     }
//   }
// }

// // return int
// async function balanceOf(accountId) {
//   const account = accountsMap.get(accountId)
//   let response
//   try {
//     response = await account.contract.balanceOf({ tokenOwner: account.publicKey })
//     console.log("balance:" + JSON.stringify(response))
//   } catch (e) {
//     console.error(e)
//   }
//   return response
// }

// // return string
// async function totalSupply() {
//   let response
//   try {
//     response = await ownerAccount.contract.totalSupply({})
//     console.log("totalSupply:" + JSON.stringify(response))
//   } catch (e) {
//     console.error(e)
//   }
//   return response
// }

// // return true or false
// async function mint(accountId, value) {
//   const account = accountsMap.get(accountId)
//   let tx
//   try {
//     tx = await callContractMethod(account.contract, 'mint', { tokens: value })
//     console.log("mint:" + JSON.stringify(tx))
//   } catch (e) {
//     console.error(e)
//   }
//   return tx
// }

// // return true or false
// async function burn(accountId, value) {
//   const account = accountsMap.get(accountId)
//   let tx
//   try {
//     tx = await callContractMethod(account.contract, 'burn', { tokens: value })
//     console.log("burn:" + JSON.stringify(tx))
//   } catch (e) {
//     console.error(e)
//   }
//   return tx
// }

// // return true or false
// async function transfer(fromAccountId, toAccountId, value) {
//   const fromAccount = accountsMap.get(fromAccountId)
//   const toAccount = accountsMap.get(toAccountId)
//   let tx
//   try {
//     tx = await callContractMethod(fromAccount.contract, 'transfer', { to: toAccount.publicKey, tokens: value })
//     console.log("transfer:" + JSON.stringify(tx))
//   } catch (e) {
//     console.error(e)
//   }
//   return tx
// }

// // return true or false
// async function addModerator(accountId) {
//   const account = accountsMap.get(accountId)
//   let tx
//   try {
//     tx = await callContractMethod(ownerAccount.contract, 'addModerator', { moderator: account.publicKey })
//     console.log("addModerator:" + JSON.stringify(tx))
//   } catch (e) {
//     console.error(e)
//   }
//   return tx
// }

// // return true or false
// async function removeModerator(accountId) {
//   const account = accountsMap.get(accountId)
//   let tx
//   try {
//     tx = await callContractMethod(ownerAccount.contract, 'removeModerator', { moderator: account.publicKey })
//     console.log("removeModerator:" + JSON.stringify(tx))
//   } catch (e) {
//     console.error(e)
//   }
//   return tx
// }


// var args = process.argv.slice(2)
// if (args[0] === 'test') {
//   const test = async _ => {
//     await createAccounts(4).catch(console.error)

//     const accounts = Array.from(accountsMap)
//     console.log(JSON.stringify(accounts[0][0]))

//     //await getBalances();
//     await balanceOf(accounts[2][0])
//     await totalSupply()
//     await addModerator(accounts[2][0])
//     await mint(accounts[2][0], '1000')
//     await balanceOf(accounts[2][0])
//     await balanceOf(accounts[0][0])
//     await totalSupply()
//     await transfer(accounts[2][0], accounts[3][0], '100')
//     await removeModerator(accounts[2][0])
//     await burn(accounts[3][0], '50')
//     await getBalances()
//   }

//   test()
// }

// module.exports = {
//   createAccounts,
//   loadAccounts,
//   getBalances,
//   balanceOf,
//   totalSupply,
//   mint,
//   burn,
//   transfer,
//   addModerator,
//   removeModerator
// }