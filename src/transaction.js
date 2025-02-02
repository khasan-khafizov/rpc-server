var personajs = require('personajs');
var account = require('./account');
var network = require('./network');
var leveldb = require('./leveldb');
var bs58check = require('bs58check');
var async = require('async');

const BASE_URL_GET_TX_BY_ID_V1 = '/api/transactions/get?id=';
const BASE_URL_GET_TX_BY_ID_V2 = '/api/v2/transactions/';

function get(req, res, next) {
    network.getFromNode(`/api/transactions/get?id=${req.params.id}`, function (err, response, body) {
        if (err) next();
        else {
            body = JSON.parse(body);
            res.send(body);
            next();
        }
    });
}

function createBip38(req, res, next) {
    account.getBip38Keys(req.params.userid, req.params.bip38).then(function (acc) {
        var transaction = personajs.transaction.createTransaction(req.params.recipientId, req.params.amount, null, req.params.bip38, null, '66', false);
        transaction.senderPublicKey = acc.keys.getPublicKeyBuffer().toString("hex");
        transaction.userid = req.params.userid;
        delete transaction.signature;
        delete transaction.secret;
        personajs.crypto.sign(transaction, acc.keys);
        transaction.id = personajs.crypto.getId(transaction);
        leveldb.setObject(transaction.id, transaction).then(function () {
            res.send({
                success: true,
                transaction
            });
            next();
        }).catch(function (err) {
            res.send({
                success: false,
                err: err
            });
            next();
        });
    }).catch(function (err) {
        res.send({
            success: false,
            err: err
        });
        next();
    });
}

function create(req, res, next) {
    var amount = parseInt(req.params.amount);
    var transaction = personajs.transaction.createTransaction(req.params.recipientId, amount, null, req.params.passphrase, null, '66', false);
    leveldb.setObject(transaction.id, transaction).then(function () {
        res.send({
            success: true,
            transaction
        });
        next();
    }).catch(function (err) {
        res.send({
            success: false,
            err
        });
        next();
    });
}

function getAll(req, res, next) {
    // Avar tx = db.get('transactions');
    next();
}

function broadcast(req, res, next) {
    if (req.params.transactions) { //old way
        Promise.all(
            req.params.transactions.map((transaction) =>
                network.broadcast(transaction, function () {
                    return Promise.resolve(transaction);
                })
            )
        ).then((transactions) => {
            res.send({
                success: true,
                transactionIds: req.params.transactions.map((tx) => tx.id)
            });
            next();
        });
    } else leveldb.getObject(req.params.id).then(function (transaction) {
        transaction = transaction || req.params;
        if (!personajs.crypto.verify(transaction)) {
            res.send({
                success: false,
                error: "transaction does not verify",
                transaction
            });
            return next();
        }
        network.broadcast(transaction, function (broadcastResult) {
            res.send({
                success: true,
                transaction
            });
            return next();
        });
    }).catch(function (err) {
        res.send({
            success: false,
            err: 'Transaction not found in the local database'
        });
        next();
    });
}

function peekBlocks(req, res, next) {

    let body = {};
    body.blocks = [];
    let offset = 0;

    network.getFromNode(`/api/blocks?offset=0`, function (err, response, body) {
        body = JSON.parse(body);
        offset = body.blocks[0].height - req.params.height;
        network.getFromNode(`/api/blocks?limit=1&offset=` + offset, function (err, response, body) {
            body = JSON.parse(body);
            res.send(body);
            next();
        })
    })
}

function peekBlocksV2(req, res, next) {

    let body = {};
    body.blocks = [];
    let offset = 0;

    network.getFromNode(`/api/v2/blocks?offset=0`, function (err, response, body) {
        body = JSON.parse(body);
        offset = body.blocks[0].height - req.params.height;
        network.getFromNode(`/api/v2/blocks?limit=1&offset=` + offset, function (err, response, body) {
            body = JSON.parse(body);
            res.send(body);
            next();
        })
    })
}

function peekTransactions(req, res, next) {

    let body = {};
    body.blocks = [];
    let offset = req.params.cursor;

    network.getFromNode(`/api/transactions?offset=` + offset, function (err, response, body) {
        body = JSON.parse(body);
        body = body.transactions ? body.transactions[0] : body;
        res.send(body);
        next();
    })
}

function peekTransactionsV2(req, res, next) {

    let body = {};
    body.blocks = [];
    let offset = req.params.cursor;

    network.getFromNode(`/api/v2/transactions?offset=` + offset, function (err, response, body) {
        body = JSON.parse(body);
        body = body.transactions ? body.transactions[0] : body;
        res.send(body);
        next();
    })
}


function getTransaction(req, res, next) {

    let body = {};
    body.blocks = [];
    let id = req.params.id;

    network.getFromNode(BASE_URL_GET_TX_BY_ID_V1 + id, function (err, response, body) {
        body = JSON.parse(body);
        body = body.transactions ? body.transactions[0] : body;
        res.send(body);
        next();
    })
}

function getTransactionV2(req, res, next) {

    let body = {};
    body.blocks = [];
    let id = req.params.id;

    network.getFromNode(BASE_URL_GET_TX_BY_ID_V2 + id, function (err, response, body) {
        body = JSON.parse(body);
        body = body.transactions ? body.transactions[0] : body;
        res.send(body);
        next();
    })
}

function postTransaction(req, res, next) {

    let networkObj = null;
    if (req.params.network === 'testnet') {
        networkObj = {network: network.networks.testnet}
    }

    network.getFromNode(`/api/transactions/get?id=` + req.params.id, function (err, response, body) {
        if (JSON.parse(body).success) {
            res.send({
                success: false,
                err: 'Transaction already exists'
            });
            next();
        } else {
            leveldb.getObject(req.params.id).then(function (transaction) {

                account.getBip38Keys(transaction.userid, req.params.bip38, networkObj).then(function (acc) {
                    let address = acc.keys.getAddress();
                    network.getFromNode(`/api/accounts?address=${address}`, function (err, response, body) {
                        let x = JSON.parse(body);
                        if (x.account.balance < transaction.amount + transaction.fee) {
                            res.send({
                                success: false,
                                err: 'Insufficient funds'
                            });
                            next();
                        } else {
                            network.postTransaction(transaction, function (err, response, body) {
                                res.send(body);
                                next();
                            })
                        }
                    })
                })
            })
        }
    })

}

function curateTransactions(transactions) {

    return transactions.map((transaction, index, transactions) => {

        let transactionObj = {};
        transactionObj.id = transaction.id;
        transactionObj.type = transaction.type;
        transactionObj.amount = transaction.amount;
        transactionObj.fee = transaction.fee;
        transactionObj.senderId = transaction.senderId;
        transactionObj.senderPublicKey = transaction.senderPublicKey;
        transactionObj.recipientId = transaction.recipientId;
        transactionObj.timestamp = transaction.timestamp;

        return transactionObj;

    });
}

function transactionsFromHeight(req, res, next) {
    let body = {};
    let transactions = [];
    let address = req.params.address;
    let height = req.params.height;
    let i = 0;
    async.doWhilst(
        function (cb) {
            let currHeight = (100 * i) + +height;
            currHeight--;
            let url = `/peer/blocks?lastBlockHeight=` + currHeight;
            network.getFromNode(url, function (err, response, body) {
                body = JSON.parse(body);
                let blocks = body.blocks.filter(block => (block.numberOfTransactions > 0));
                let txsAgg = [];
                blocks.forEach(block => {
                    txsAgg = txsAgg.concat(block.transactions)
                })
                if (address) {
                    txsAgg = txsAgg.filter(transaction => transaction.senderId === address || transaction.recipientId === address);
                }
                txsAgg = curateTransactions(txsAgg);
                transactions = transactions.concat(txsAgg);
                i++;
                cb();
            })
        }, function () {
            return i < 10;
        }, function (err) {
            if (err) {
                next();
            } else {
                res.send({
                    transactionCount: transactions.length,
                    transactions: transactions
                });
                next();
            }
        })
}

module.exports = {
    create,
    createBip38,
    get,
    broadcast,
    peekBlocks,
    peekBlocksV2,
    peekTransactions,
    peekTransactionsV2,
    transactionsFromHeight,
    getTransaction,
    getTransactionV2,
    postTransaction
};
