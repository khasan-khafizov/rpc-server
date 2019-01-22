### RPC server implementation to easily connect to PERSONA blockchain

# Security Warning
All calls should be made from the server where RPC is running at ( i.e., `localhost` or `127.0.0.1` ). The RPC server should never be publicly accessible. If you wish to access persona-rpc from a remote address, you can whitelist the address with `--allow <address>`. Addresses allow you to use wildcards, eg. `192.168.1.*` or `10.0.*.*`.

If you do want to allow access from all remotes, start persona-rpc with the `--allow-remote` commandline switch. This can be dangerous.

# How To Use It
- install Node.JS ( https://nodejs.org/en/download/package-manager/)
- install forever `npm install -g forever`
- install persona-rpc: `npm install Persona-blockchain/persona-rpc#master`
- start RPC server: `persona-rpc --port 8000` (default port is 8080)

## Docker ##
If you would like to run from a docker environment, you will first need to build the container by running:
```
docker build -t persona-rpc .
```
You will need to run the container with the `--allow-remote` option to allow the host machine to access the container.
```
docker run -d -p 8080:8080 persona-rpc --allow-remote
```

# API
Supported networks are `mainnet` and `testnet` all calls should start with the network you want to address, for instance,  `/mainnet/account/PFiYxjjF3VhxqWZLGpTzYBrpmkuNHMfK8t` we call it `:network` in the API description.

## Accounts
- Get account balance from `address`: `GET /:network/account/:address`
- Create account from `passphrase`: `POST /:network/account` params: `passphrase`
- Create (or get if already existing) account and encrypt using bip38: `POST /:network/account/bip38` params: `bip38` (password for encrypted WIF), `userid` (to identify a user)
- Get backup from `userid`: `GET /:network/account/bip38/:userid`

If you want to create several accounts for one user, you need to use a different userid.

## Transactions
- Get last 50 transactions from `address`: `GET /:network/transactions/:address`
- Create a transaction: `POST /:network/transaction` params: `recipientId`, `amount` in satoshis, `passphrase`
- Create a transaction using `bip38` for `userid`: `POST /:network/transaction/bip38` params: `recipientId`, `amount` in satoshis, `bip38` (password to encode wif), `userid`
- Broadcast transaction: `POST /:network/broadcast` params: `id` of the transaction

FOLLOWING APIS return all txs between [height, height+1000) (account address filter can be provided), ordered ascending by height.

GET testnet/transactions/fromHeight/{height}
	- example : /testnet/transactions/fromHeight/1019272
GET testnet/account/{address}/fromHeight/{height}
	- example : /testnet/account/Tuo2S5FsZL74k8axgL73JVcNo9PSfM8kPc/fromHeight/1018192

Note that if the transaction has been created via the RPC it has been stored internally, as such only the transaction `id` is needed to broadcast/rebroadcast it. Otherwise if created outside of this RPC server, pass the whole transaction body as the POST payload.

## Basic Flow :

STEP 1 : CREATE ACCOUNT

POST /testnet/account/bip38
BODY
{
  "bip38":"beep beep boop",
  "userid":"777822f71a814e45cf9ea9de31b05a7e86f4a8e8f25fa2caf34c4effc645d8a8"
}
RESPONSE
{
"success": true,
"publicKey": "035ac124d365e1290eb4b64f55f2deface2d17f332f87c5d15829ad87d78437b8b",
"address": "TkWrTYhQjYt6KTN4obmepxG4ttfWhJYARj",
"wif": "6PYQHiF4Te2LdBayLkuJAX5mem91Dzro1CBHt2B2TPEHQTiHX7vGVaMXeD"
}

STEP 2 : CREDIT the account <TkWrTYhQjYt6KTN4obmepxG4ttfWhJYARj> with tokens ( or alternatively use an existing recipient at step 3 )

STEP 3 : CREATE TX ( SENDER IS THE RECIPIENT IN THE EXAMPLE BELOW )

POST /testnet/transaction/bip38
BODY
{
"amount":1,
"bip38":"beep beep boop",
"recipientId": "TkWrTYhQjYt6KTN4obmepxG4ttfWhJYARj",
"userid":"777822f71a814e45cf9ea9de31b05a7e86f4a8e8f25fa2caf34c4effc645d8a8"
}

RESPONSE
{
"success": true,
"transaction":{
"type": 0,
"amount": 1,
"fee": 10000000,
"recipientId": "TkWrTYhQjYt6KTN4obmepxG4ttfWhJYARj",
"timestamp": 53317749,
"asset":{},
"senderPublicKey": "035ac124d365e1290eb4b64f55f2deface2d17f332f87c5d15829ad87d78437b8b",
"id": "8e87adcb8695c24cf94097274b059e1d3920f24b48d544ba6a2479a2d33dcd96",
"signature": "30440220507fe0c43afb568f653571b0cb8eefb7b16c76e3a9fe2bfc05ca401c9810ee48022060c4d62949bd0a117ce8c07c489fcd7823923b6b9cfa3109742b89caa3127f39"
}
}

STEP 4 : BROADCAST TX

POST /testnet/broadcast

{"id":"8e87adcb8695c24cf94097274b059e1d3920f24b48d544ba6a2479a2d33dcd96"}

STEP 5 : SEE IN EXPLORER

https://testnet-explorer.persona.im/#/transaction/8e87adcb8695c24cf94097274b059e1d3920f24b48d544ba6a2479a2d33dcd96

## Security

If you discover a security vulnerability within this project, please send an e-mail to security@persona.io. All security vulnerabilities will be promptly addressed.

## License

The MIT License (MIT)
