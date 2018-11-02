var request = require('request');
var async = require('async');
var personajs = require('personajs');

var network = null,
  server = null;

var networks = {
  testnet: {
    name: "testnet",
    nethash: "a6a53c0da7822012da6de41cdcaef2ecad885c7df2fc97011e5c40c5684f80a9",
    slip44: 1,
    version: 66,
    peers: [
        "5.135.75.64:4101",
        "5.135.75.65:4101",
        "5.135.75.66:4101",
        "5.135.75.67:4101",
        "5.135.75.68:4101"
    ]
  },
  mainnet: {
    name: "mainnet",
    slip44: 111,
    nethash: "14b55c1de06caa015362d59ad97a144bc3c9fc2b50ece84b78d13ceaeaf7d8fb",
    version: 55,
    peers: [
      "89.40.7.63:4102",
      "192.99.54.32:4102",
      "45.77.180.23:4102",
      "5.135.75.77:4102",
    ]
  }
};

function getFromNode(url, cb) {
  var nethash = network ? network.nethash : "";
  if (!url.startsWith("http")) {
    url = `http://${server}${url}`;
  }
  request(
    {
      url,
      headers: {
        nethash,
        version: '2.0.0',
        port: 1
      },
      timeout: 5000
    },
    function(error, response, body){
      if(error){
        server = network.peers[Math.floor(Math.random() * 1000) % network.peers.length];
      }
      cb(error, response, body);
    }
  );
}

function findEnabledPeers(cb) {
  var peers = [];
  getFromNode('/peer/list', function (err, response, body) {
      var body = JSON.parse(body);

      if (err || !body || !body.peers) {
          return cb(peers);
      }
  console.log(body);
      var respeers = body.peers.filter(function (peer) {
          return peer.status == "OK";
      }).map(function (peer) {
          return `${peer.ip}:${peer.port}`;
      });
    async.each(respeers, function (peer, eachcb) {
      getFromNode(`http://${peer}/api/blocks/getHeight`, function (error, res, body2) {
        if (!error && body2 != "Forbidden") {
          peers.push(peer);
        }
        eachcb();
      });
    }, function (error) {
      if (error) return cb(error);

      return cb(peers);
    });

  });
}

function postTransaction(transaction, cb) {
  request(
    {
      url: `http://${server}/peer/transactions`,
      headers: {
        nethash: network.nethash,
        version: '1.0.0',
        port: 1
      },
      method: 'POST',
      json: true,
      body: {transactions: [transaction]}
    },
    cb
  );
}

function broadcast(transaction, callback) {
  network.peers.slice(0, 10).forEach(function (peer) {

    request({
      url: `http://${peer}/peer/transactions`,
      headers: {
        nethash: network.nethash,
        version: '1.0.0',
        port: 1
      },
      method: 'POST',
      json: true,
      body: {transactions: [transaction]}
    }, function(err, res, body) {
        callback(body)
    });
  });
}


function connect2network(netw, callback) {
  network = netw;
  server = netw.peers[Math.floor(Math.random() * 1000) % netw.peers.length];
  findEnabledPeers(function (peers) {
    if (peers.length > 0) {
      [server] = peers;
      netw.peers = peers;
    }
    callback();
  });
  getFromNode('/api/loader/autoconfigure', function (err, response, body) {
    if (err) return;
    if (!body || !body.startsWith("{"))
      connect2network(netw, callback);
    else {
      netw.config = JSON.parse(body).network;
    }
  });
}

function connect(req, res, next) {
  if (!server || !network || network.name != req.params.network) {
    if (networks[req.params.network]) {
      personajs.crypto.setNetworkVersion(networks[req.params.network].version);
      connect2network(networks[req.params.network], next);
    } else {
      res.send({
        success: false,
        error: `Could not find network ${req.params.network}`
      });
      res.end();
    }
  } else {
    next();
  }
}


module.exports = {
  broadcast,
  connect,
  getFromNode,
  postTransaction
};
