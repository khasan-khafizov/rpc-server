var personajs = require('personajs');
var bip39 = require('bip39');
var bip38 = require('bip38');
var BigInteger = require('bigi');
var network = require('./network');
var leveldb = require('./leveldb');
var async = require('async');

function get(req, res, next) {
    network.getFromNode(`/api/accounts?address=${req.params.address}`, function (err, response, body) {
        if (err) next();
        else {
            body = JSON.parse(body);
            res.send(body);
            next();
        }
    });
}

function getV2(req, res, next) {
    network.getFromNode(`/api/v2/wallets/` + `${req.params.address}`, function (err, response, body) {
        if (err) next();
        else {
            body = JSON.parse(body);
            res.send(body);
            next();
        }
    });
}

function getTransactions(req, res, next) {
    const offset = req.query.offset || 0;
    network.getFromNode(`/api/transactions?offset=${offset}&orderBy=timestamp:desc&senderId=${req.params.address}&recipientId=${req.params.address}`, function (err, response, body) {
        if (err) next();
        else {
            body = JSON.parse(body);
            res.send(body);
            next();
        }
    });
}

function getTransactionsV2(req, res, next) {
    const offset = req.query.offset || 0;
    network.getFromNode(`/api/v2/transactions?offset=${offset}&orderBy=timestamp:desc&senderId=${req.params.address}&recipientId=${req.params.address}`, function (err, response, body) {
        if (err) next();
        else {
            body = JSON.parse(body);
            res.send(body);
            next();
        }
    });
}


function getBip38Account(req, res, next) {
    leveldb.getUTF8(personajs.crypto.sha256(Buffer.from(req.params.userid)).toString('hex')).then(function (wif) {
        res.send({
            success: true,
            wif
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

function getBip38Keys(userid, bip38password, network) {
    return leveldb.getUTF8(personajs.crypto.sha256(Buffer.from(userid)).toString('hex')).then(function (wif) {
        if (wif) {
            var decrypted = bip38.decrypt(wif.toString('hex'), bip38password + userid);
            var keys = new personajs.ECPair(BigInteger.fromBuffer(decrypted.privateKey), null, network);
            return Promise.resolve({
                keys,
                wif
            });
        }

        return Promise.reject(new Error("Could not find WIF"));
    });
}

function createBip38(req, res, next) {
    var keys = null;
    let networkObj = null;
    if (req.params.network === 'testnet') {
        networkObj = {network: network.networks.testnet}
    }
    if (req.params.bip38 && req.params.userid) {
        getBip38Keys(req.params.userid, req.params.bip38, networkObj).catch(function () {
            keys = personajs.crypto.getKeys(bip39.generateMnemonic(), {network: network.networks.testnet});
            var encryptedWif = bip38.encrypt(keys.d.toBuffer(32), true, req.params.bip38 + req.params.userid);
            leveldb.setUTF8(personajs.crypto.sha256(Buffer.from(req.params.userid)).toString("hex"), encryptedWif);

            return Promise.resolve({
                keys,
                wif: encryptedWif
            });
        }).then(function (account) {
            res.send({
                success: true,
                publicKey: account.keys.getPublicKeyBuffer().toString("hex"),
                address: account.keys.getAddress(),
                wif: account.wif
            });
            next();
        }).catch(function (err) {
            if (err) {
                res.send({
                    success: false,
                    err
                });
            }
            next();
        });
    } else {
        res.send({
            success: false,
            err: "Wrong parameters"
        });
        next();
    }
}

function create(req, res, next) {
    var account = null;
    if (req.params.passphrase) {
        account = personajs.crypto.getKeys(req.params.passphrase);
        res.send({
            success: true,
            account: {
                publicKey: account.publicKey,
                address: personajs.crypto.getAddress(account.publicKey)
            }
        });
        next();
    } else {
        res.send({
            success: false,
            err: "Wrong parameters"
        });
        next();
    }
}

module.exports = {
    get,
    getV2,
    getBip38Account,
    getBip38Keys,
    getTransactions,
    getTransactionsV2,
    create,
    createBip38
};
