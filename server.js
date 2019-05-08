#! /usr/bin/env forever

var restify = require('restify');
var account = require('./src/account');
var transaction = require('./src/transaction');
var network = require('./src/network');
var program = require('commander');

const allowedRemotes = [
  "::1",
  "127.0.0.1",
  "::ffff:127.0.0.1"
];

var server = null;

function restrictHost(req, res, next){
  var remote = req.connection.remoteAddress;
  if (remote.startsWith("::ffff:")) remote = remote.replace("::ffff:", "");
  if(program.allowRemote) return next();
  else
    if(req.getRoute().path == '/:network/broadcast') return next();
    else
      if(program.allow.includes(remote)) return next();
      else
        for(let item of program.allow) {
          let mask = item.split(/[\:\.]/);
          let address = remote.split(/[\:\.]/);
          let ok = true;
          for (let i = 0; i < mask.length; i++)
            if (mask[i] === "*") continue;
            else
              if (mask[i] !== address[i]) { ok = false; break; }
              else continue;
          if (ok) return next();
        };
  res.end();
}

function startServer(port){
  if (program.allowRemote) console.log('Warning! persona-rpc allows remote connections, this is potentially insecure!');

  server = restify.createServer().
    use(restrictHost).
    use(restify.plugins.bodyParser({mapParams: true})).
    use(restify.plugins.queryParser({mapParams: true})).
    use(network.connect);

    server.get('/:network/transaction/:id', transaction.getTransaction);
    server.get('/:network/v2/transaction/:id', transaction.getTransactionV2);
    server.get('/:network/account/:address', account.get);
    server.get('/:network/v2/account/:address', account.getV2);
    server.get('/:network/account/transactions/:address', account.getTransactions);
    server.get('/:network/v2/account/transactions/:address', account.getTransactionsV2);
    server.get('/:network/transactions/:address', account.getTransactions);
    server.get('/:network/v2/transactions/:address', account.getTransactionsV2);

    // returns block at given height
    server.get('/:network/peek/blocks/:height', transaction.peekBlocks);
    server.get('/:network/v2/peek/blocks/:height', transaction.peekBlocksV2);

    // returns the tx at given cursor (i-th overall, no filtering)
    server.get('/:network/peek/transactions/:cursor', transaction.peekTransactions);
    server.get('/:network/v2/peek/transactions/:cursor', transaction.peekTransactionsV2);

    // returns all txs between [height, height+1000), ordered ascending by height.
    server.get('/:network/transactions/fromHeight/:height', transaction.transactionsFromHeight);

    // same as above, but can also specify the account address
    server.get('/:network/account/:address/fromHeight/:height', transaction.transactionsFromHeight);

    server.get('/:network/account/bip38/:userid', account.getBip38Account);
    server.post('/:network/account/bip38', account.createBip38);
    server.post('/:network/account', account.create);
    server.post('/:network/transaction/bip38', transaction.createBip38);
    server.post('/:network/transaction', transaction.create);
    server.post('/:network/broadcast', transaction.broadcast);
    server.post('/:network/transactions/', transaction.postTransaction);

    server.listen(port, function() {
      console.log('persona-rpc listening at %s', server.url);
    });
}

program.
  option('-p, --port <port>', 'The port to start server').
  option('--allow-remote', 'Allow all connections from sources other than localhost').
  option('--allow <address>', 'Add addresses to the whitelist. Allows usage of * for placeholder in addresses, eg. 192.168.178.* or 10.0.*.*.', (val, memo) => {
    memo.push(val);
    return memo;
  }, allowedRemotes).
  parse(process.argv);

if(program.port)
  startServer(program.port);
else
  startServer(9999);

// For testing purpose
module.exports = server;
