const express = require('express')
const app = express()
const cors = require('cors')
const bodyParser = require('body-parser')
const exceptionHandler = require('./exceptionHandler')
const mysqlx = require('@mysql/xdevapi')
const config = require('./config.json')
const { timer, Observable, of } = require('rxjs')
const { concatMap } = require('rxjs/operators')

const dbClient = mysqlx.getClient(config.database.connection)

const targetWallet = require('zano-rpc-js').RPCWallet
const targetClient = targetWallet.createWalletClient({
  url: config.target.walletAddress
})
targetClient.sslRejectUnauthorized(false)

const rpcWallet = require('@arqma/arqma-rpc').RPCWallet
const walletClient = rpcWallet.createWalletClient({
  url: config.source.walletAddress
})
walletClient.sslRejectUnauthorized(false)

const log = (msg, override = 0) => {
    if (!config.debug && override === 0)
        return
    let now = new Date()
    console.log(
        now.getFullYear() +
            '-' +
            now.getMonth() +
            '-' +
            now.getDate() +
            ' ' +
            now.getHours() +
            ':' +
            now.getMinutes() +
            ':' +
            now.getSeconds() +
            '.' +
            now.getMilliseconds() +
            ' ' +
            msg
    )
}

const getTransactions = async (transactionId) => {
    try {
        const session = await dbClient.getSession()
    let result = await session.sql(`Select * from swaps where txid = '${transactionId}';`).execute()
    if (result.hasData()) {
        let swap = result.fetchOne()
        log(`getTransactions ${JSON.stringify(swap)}`)
        return swap
    }
    } catch (error) {
        log(`getTransactions ERROR ${error}`, 1)
    }
    log(`getTransactions no transactions`)
    return []
}

const saveSwap = async(swap) => {
    try {
        const session = await dbClient.getSession()
        session.startTransaction()
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
            status,
            new_address,
            new_amount
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
            0,
            '${swap.new_address}',
            ${swap.new_amount}
        );`
        let result = await session.sql(query).execute()
        session.commit()
        log(`saveSwap ${JSON.stringify(swap)}`)
    } catch (error) {
        log(`saveSwap ERROR ${error}`, 1)
    }
}

const isValidTransactionId = async(transactionId) => {
    let invalidResponse = {isValid: false, message: 'TransactionId is not valid'}
    let expression = /((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+[0-9a-z]+$/i
    
    try {
        // null or empty
        if (!!transactionId) {
            // length
            if (transactionId.length !== config.source.transactionIdLength)
                return invalidResponse

            // must be a-z A-Z 0-9 mix
            if (!transactionId.match(expression))
                return invalidResponse
            
            // valid
            return {isValid: true, message: 'valid'}
        }
    } catch (error) {
        log(`isValidTransactionId ERROR ${error}`, 1)
    }
    return invalidResponse
}

const isValidSwapAddress = async(swapAddress) => {
    let invalidResponse = {isValid: false, message: 'Swap address is not valid'}
    let expression = /((^[0-9]+[a-z]+)|(^[a-z]+[0-9]+))+[0-9a-z]+$/i
    try {
        // null or empty
        if (!!swapAddress) {
            // length
            if (swapAddress.length !== config.target.swapAddressLength)
                return invalidResponse

            // must be a-z A-Z 0-9 mix
            if (!swapAddress.match(expression))
                return invalidResponse

            // validate against daemon
            if (!swapAddress.startsWith(config.target.swapAddressPrefix))
                return invalidResponse
            
            // valid
            return {isValid: true, message: 'valid'}
        }
    } catch (error) {
        log(`isValidSwapAddress ERROR ${error}`, 1)
    }
    return invalidResponse
}

const calculateSwapAmount = async(transaction) => {
    try {
        // 100 000000000 / 1000000000 === 100 evolution
        const sourceAmount = transaction.amount / config.source.atomicUnits

        // 100 evolution / 10 (ratio) === 10  EvoX
        const targetAmount = (sourceAmount / config.target.ratio).toFixed(config.target.atomicUnits.toString().length -1)  
    
        // 10 * 1000000000000 === 10000000000000
        transaction.new_amount = targetAmount * config.target.atomicUnits
        let result = {success: true, transaction}
        log(`calculateSwapAmount ${JSON.stringify(result)}`)
        return result
    } catch (error) {
        log(`saveSwap ERROR ${error}`, 1)
        return {success: false}
    }
}

const getSwaps = async() => {
    try {
        const session = await dbClient.getSession()
        session.startTransaction()
        // status 0 === unprocessed && confirmations > 2
        let query = `SELECT txid, new_address, new_amount, status, confirmations FROM swaps WHERE status = 0 AND confirmations > ${config.source.confirmations};`
        let result = await session.sql(query).execute()
        session.commit()
        if (result.hasData()) {
            let swaps = result.fetchAll()
            log(`getSwaps ${JSON.stringify(swaps)}`)
            return swaps
        }
    } catch (error) {
        log(`getSwaps ERROR ${error}`, 1)
    }  
    return []
}

const updateSwap = async(transfer, swap) => {
    try {
        const session = await dbClient.getSession()
        session.startTransaction()
        let query = `UPDATE swaps set status = 1, new_txid = '${transfer.tx_hash}', new_timestamp = ${new Date().getTime()} WHERE txid = '${swap[0]}';` // status 1 === processed
        await session.sql(query).execute()
        session.commit()
        log(`updateSwap SUCCESS swap completed...`)
    } catch (error) {
        log(`updateSwap ERROR ${error}`, 1)
    }  
}

const transferSwap = async(swap) => {
    try {
        let options = {
            destinations: [
                {
                    amount: swap[2] - config.target.fee,
                    address: swap[1]
                }],
            mixin: config.target.mixin,
            fee: config.target.fee,
            comment: config.target.comment
        }
        result = await targetClient.transfer(options)
        // let result = {
        //                 tx_hash: '90796ef384f803d2aca1e32f0fce91a07b86ab8745cfaa1ebe60f7ae07c7e0d8',
        //                 tx_unsigned_hex: '',
        //                 tx_size: 0
        //              }
        return {success: true, result}
    } catch (error) {
        log(`transferSwap ERROR ${error}`, 1)
        return {success: false}
    }
}

const transfer_UnProcessed_Swaps_To_Target_Wallet = async() => {
    try {
        let swaps = await getSwaps()
        log(`transfer started....`, 1)
        for (const swap of swaps) {
            let processed = await transferSwap(swap)
            
            if (processed.success)
            {
                //update database status to processed
                await updateSwap(processed.result, swap)

                //maybe websocket.emit back to angular FE
            }
        }
    log(`transfer completed...`, 1)
    } catch (error) {
        log(`transfer_UnProcessed_Swaps_To_Target_Wallet ERROR ${error}`, 1)
    }
    return
}

const processSwap = async() => {

    timer(config.due, config.schedule)
        .pipe(concatMap(() => transfer_UnProcessed_Swaps_To_Target_Wallet() ))
        .subscribe();
}

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended: false}))

app.use(cors({
    origin: '*'
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
                    return res.json({error: config.source.doubleSpendMessage})
                }
                else {
                    response.transfer.new_address = swap.swapAddress
                    const transactionDetails = await calculateSwapAmount(response.transfer)
                    if (!transactionDetails.success) {
                        return res.json({error: 'Error calculating ratio'})
                    }
                    await saveSwap(transactionDetails.transaction)
                }
            }
            
            return res.json({success: 'Please check your new wallet for swap amount'})
        }
        
    } catch (error) {
        log(`/api/swap ERROR ${error}`, 1)
        res.json({error})
    }
}))

app.listen(config.serverPort, async () => {
    log('Listening on port 3000')
    await processSwap()
})