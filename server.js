const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const exceptionHandler = require('./exceptionHandler')
const mysqlx = require('@mysql/xdevapi')
const config = require('./config.json')

const dbClient = mysqlx.getClient(config.database.connection)

const getTransactions = async (transactionId) => {
    try {
        const session = await dbClient.getSession()
    let result = await session.sql(`Select * from swaps where txid = '${transactionId}';`).execute()
    if (result.hasData())
        return result.fetchOne()
    } catch (error) {'getTransactions ERROR ', error }
    return []
}

const saveSwap = async(swap) => {
    try {
        const session = await dbClient.getSession()
        let query = `INSERT INTO swaps 
        (
            txid, 
            address, 
            amount, 
            confirmations, 
            double_spend_seen,
            fee,
            height,
            note,
            payment_id,
            subaddr_index,
            suggested_confirmations_threshold,
            timestamp,
            type,
            unlock_time,
            status
        )
        VALUES
        (
            '${swap.txid}',
            '${swap.address}',
            ${swap.amount},
            ${swap.confirmations},
            ${swap.double_spend_seen},
            ${swap.fee},
            ${swap.height},
            '${swap.note}',
            '${swap.payment_id}',
            '${JSON.stringify(swap.subaddr_index)}',
            ${swap.suggested_confirmations_threshold},
            ${swap.timestamp},
            '${swap.type}',
            ${swap.unlock_time},
            0
        );`
        let result = await session.sql(query).execute()
    } catch (error) {
        console.log('saveSwap ERROR ', error)
    }
}

const isValidTransactionId = async(transactionId) => {
    let invalidResponse = {isValid: false, message: 'TransactionId is not valid'}
    let expression = /((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+[0-9a-z]+$/i
    
    // null or empty
    if (!!transactionId) {
        // length
        if (transactionId.length !== config.transactionIdLength)
            return invalidResponse

        // must be a-z A-Z 0-9 mix
        if (!transactionId.match(expression))
            return invalidResponse
        
        // valid
        return {isValid: true, message: 'valid'}
    }
    return invalidResponse
}

const isValidSwapAddress = async(swapAddress) => {
    let invalidResponse = {isValid: false, message: 'Swap address is not valid'}
    let expression = /((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+[0-9a-z]+$/i
    console.log(swapAddress)
    // null or empty
    if (!!swapAddress) {
console.log(swapAddress.length)
        // length
        if (swapAddress.length !== config.swapAddressLength)
            return invalidResponse

        // must be a-z A-Z 0-9 mix
        if (!swapAddress.match(expression))
            return invalidResponse

        // validate against daemon
        if (!swapAddress.startsWith(config.swapAddressPrefix))
            return invalidResponse
        
        // valid
        return {isValid: true, message: 'valid'}
    }
    return invalidResponse
}


const rpcDaemon = require('@arqma/arqma-rpc').RPCDaemon

const daemonClient = rpcDaemon.createDaemonClient({
  url: config.daemonAddress
})
daemonClient.sslRejectUnauthorized(false)


const rpcWallet = require('@arqma/arqma-rpc').RPCWallet

const walletClient = rpcWallet.createWalletClient({
  url: config.walletAddress
})
walletClient.sslRejectUnauthorized(false)

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.use(cors({
    origin: '*'
}))

app.get('/api/getversion', exceptionHandler(async (req, res) => {
    let response = await daemonClient.getVersion()
    res.json(response)
}))

app.post('/api/swap', exceptionHandler(async (req, res) => {
    try {
        if (req.body && req.body.transactionId) {
            const swap = req.body
            let validator = await isValidTransactionId(swap.transactionId)

            if (!validator.isValid) {
                return res.json({error: validator.message})
            }

            validator = await isValidSwapAddress(swap.swapAddress)
            if (!validator.isValid) {
                return res.json({error: validator.message})
            }

            // should have validated both input parameters if we make it here!

            let response = await walletClient.getTransferByTxId({txid: swap.transactionId})
            if (response) {
                let transaction = await getTransactions(swap.transactionId) 
                if (transaction && transaction.length > 0) {
                    return res.json({error: 'Fuck off no double spends allowed'})
                }
                else {
                    await saveSwap(response.transfer)
                }
            }
            return res.json(response)
        }
        
    } catch (error) {
        res.json({error})
    }
}))

app.listen(config.serverPort, () => console.log('Listening on port 3000'))