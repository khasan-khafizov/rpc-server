var personajs = require('personajs');
var account = require('./account');
var network = require('./network');
var leveldb = require('./leveldb');
var async = require('async');

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
        var transaction = personajs.transaction.createTransaction(req.params.recipientId, req.params.amount, null, "dummy");
        transaction.senderPublicKey = acc.keys.getPublicKeyBuffer().toString("hex");
        delete transaction.signature;
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
                err : err
            });
            next();
        });
    }).catch(function (err) {
        res.send({
            success: false,
            err : err
        });
        next();
    });
}

function create(req, res, next) {
    var amount = parseInt(req.params.amount);
    var transaction = personajs.transaction.createTransaction(req.params.recipientId, amount, null, req.params.passphrase);
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
            err : 'Transaction not found in the local database'
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

function peekTransactions(req, res, next) {

    let body = {};
    body.blocks = [];
    let offset = req.params.cursor;

    network.getFromNode(`/api/transactions?offset=`+offset, function (err, response, body) {
            body = JSON.parse(body);
            body = body.transactions ? body.transactions[0] : body;
            res.send(body);
            next();
    })
}

function transactionsFromHeight(req, res, next) {
    let body = {};
    // we must retrieve tx after the previous block,
    // because tx are created before the corresponding (hosting) blocks, we must use the previous block's timestamp as the cutoff point
    // unless the given height is 1, is which case there is no previous block timestamp to check after
    let height = req.params.height > 1 ? req.params.height-1 : 1;

    network.getFromNode(`/api/blocks?height=` + height,  function (err, response, body) {
        body = JSON.parse(body);
        let cutOffTimestamp = body.blocks[0].timestamp;
        if (cutOffTimestamp === 0 && req.params.height === '1' ) {
            cutOffTimestamp = -1; // do not allow 0 to be a cutoff timestamp, for height = '1'
        }

        network.getFromNode(`/api/transactions?offset=0`, function (err, response, body) {
            body = JSON.parse(body);
            let transactionCount = body.count;
            let transactions = [];
            let currentOffset = transactionCount;
            let isDone = false;
            let iteration = 0;
            let limit=50;
            async.doWhilst(
                function (cb) {
                    iteration++;
                    if (currentOffset < 50) {
                        limit = currentOffset;
                        currentOffset = 0;
                    } else {
                        currentOffset = currentOffset - 50;
                    }
                    network.getFromNode(`/api/transactions?offset=` + currentOffset +`&limit=` + limit, function (err, response, body) {
                        body = JSON.parse(body);
                        if (body.transactions[0].timestamp < cutOffTimestamp) {
                            isDone = true;
                        }
                        transactions = body.transactions
                            .filter(tr => (tr.timestamp > cutOffTimestamp))
                            .concat(transactions);
                        cb();
                    });
                }, function () {
                    return iteration <= 20 && currentOffset > 0 && !isDone;
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
        })
    })
}

module.exports = {
    create,
    createBip38,
    get,
    broadcast,
    getAll,
    peekBlocks,
    peekTransactions,
    transactionsFromHeight
};
