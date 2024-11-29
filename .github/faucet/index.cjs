const {PrivateKey, P2PKH, Transaction} = require("@bsv/sdk");
const configuration = require("./config.json");
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const SatoshisPerKilobyte = require("@bsv/sdk/src/transaction/fee-models/SatoshisPerKilobyte.js");

const usersDir = path.join(__dirname, '../../');

function getConfig() {
  const {sourceTxId, sourceVout, address, topUpValue} = configuration
  const key = process.env.FAUCET_KEY_WIF

  if (!key) {
    throw new Error("Key must be provided in WIF format in FAUCET_KEY_WIF environment variable");
  }
  if (!sourceTxId) {
    throw new Error("Source transaction must be provided in config");
  }
  if (sourceVout == null) {
    throw new Error("Source vout must be provided in config");
  }

  const privateKey = PrivateKey.fromWif(key);
  if (privateKey.toAddress() !== address) {
    throw new Error(`Address ${address} doesn't belong to key ${key}`);
  }

  return {
    privateKey,
    topUpValue: topUpValue || 10,
    sourceTxId,
    sourceVout,
    address,
    key
  }
}

async function loadInput(config) {
  const {sourceTxId, sourceVout, address, privateKey} = config

  const response = await axios.get(`https://whatsonchain.com/api/rawtx/${sourceTxId}`);
  const rawTx = response.data

  const tx = Transaction.fromHex(rawTx)
  if (!tx.outputs[sourceVout]) {
    throw new Error("sourceVout not found in source transaction");
  }

  const output = tx.outputs[sourceVout]

  if (output.lockingScript.toHex() !== new P2PKH().lock(address).toHex()) {
    throw new Error(`output ${sourceVout} from tx ${sourceTxId} doesn't belong to the address ${address}`);
  }

  return {
    sourceTransaction: tx,
    sourceOutputIndex: sourceVout,
    unlockingScriptTemplate: new P2PKH().unlock(privateKey),
    sequence: 0xffffffff
  }
}

function loadUsers() {
  return fs.readdirSync(usersDir)
    .filter(file => file.endsWith('.json'))
    .map(file => {
      console.log("Loading the file", file)
      const name = file.replace('.json', '')

      let config = {}
      try {
        const content = fs.readFileSync(path.join(usersDir, file), 'utf8')
        config = JSON.parse(content)
      } catch (e) {
        console.error("Error parsing the file", file)
        return {
          name,
          file,
          error: "Error parsing the file"
        }
      }

      const error = !config.address ? "Invalid body of file, should contain address field" : null

      return {
        name,
        file,
        config,
        error
      }
    })
    .map(user => {
      let lockingScript
      try {
        lockingScript = new P2PKH().lock(user.config.address)
      } catch (e) {
        return {
          ...user,
          error: "Error creating locking script"
        }
      }
      return {
        ...user,
        lockingScript
      }
    })
    .map(user => {
      const toppedUp = !!user.config.tx
      if (toppedUp) {
        console.info("User already topped up", user.name)
      }
      return {
        ...user,
        toppedUp
      }
    })
}


(async function () {
  const config = getConfig()
  console.debug(config)

  const input = await loadInput(config)
  console.debug(input)

  const tx = new Transaction()
  tx.addInput(input)
  tx.addOutput({
    change: true,
    lockingScript: new P2PKH().lock(config.address)
  })

  const users = loadUsers()

  const usersToTopUp = users.filter(user => !user.error)
    .filter(user => !user.toppedUp)
    .map((user, index) => {
      console.log("Preparing top up for user", user.name, "on address", user.config.address)
      return {
        ...user,
        vout: index + 1,
        output: {
          satoshis: config.topUpValue,
          lockingScript: user.lockingScript
        }
      }
    })


  if (usersToTopUp.length === 0) {
    console.log("")
    console.log("No users to top up")
    console.log("FINISHED")
    return
  }

  console.log(usersToTopUp)

  usersToTopUp.forEach(user => {
    tx.addOutput(user.output)
  })

  await tx.fee(new SatoshisPerKilobyte(1))
  await tx.sign()

  const fee = tx.getFee()
  if (fee < 1) {
    console.log("")
    console.error(`Not enough funds on transaction ${config.sourceTxId} to top up users and pay the fee`)
    return
  }

  const result = await tx.broadcast()
  console.info("Broadcasting result:",result)
  if (result.status === 'error') {
    console.log("")
    console.error("Error when broadcasting:",result.more.extraInfo)
    return
  }


  const txId = tx.id('hex')
  const txHex = tx.toHex()


  configuration.sourceTxId = txId
  configuration.sourceVout = 0
  configuration._balance = tx.outputs[0].satoshis
  fs.writeFileSync(path.join(__dirname,'config.json'), JSON.stringify(configuration, null, 2))

  // update users files
  users.filter(user => user.error).forEach(user => {
    console.log("saving error in file", user.file)
    const content = {
      error: user.error,
      address: user?.config?.address
    }
    fs.writeFileSync(path.join(usersDir, user.file), JSON.stringify(content, null, 2))
  })

  usersToTopUp.forEach(user => {
    console.log("saving tx in file", user.file)
    const content = {
      ...user.config,
      error: user.error,
      tx: txHex,
      txId: txId,
      vout: user.vout
    }
    if (content.error == null) {
      delete content.error
    }

    fs.writeFileSync(path.join(usersDir, user.file), JSON.stringify(content, null, 2))
  })

})()
