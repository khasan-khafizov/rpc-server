
// Require the dev-dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server');
const personajs = require('personajs');
chai.should();

chai.use(chaiHttp);

describe('Transactions', () => {

  describe('/GET transaction', () => {
    it('it should GET last account transactions on mainnet', (done) => {
      chai.request(server).
        get('/mainnet/transactions/PSPqkmiAektdxygkricdG96GirPhm8BGXd').
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          res.body.count.should.be.above(3);
          res.body.transactions.length.should.be.above(3);
          done();
        });
    }).timeout(0);

    it('it should GET last account transactions on devnet', (done) => {
      chai.request(server).
        get('/devnet/transactions/TnGxBjNL9NDXFRjeNEk4gkze2ykYGnYUnF').
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          res.body.count.should.be.above(30);
          res.body.transactions.length.should.be.above(3);
          done();
        });
    }).timeout(0);

  });

  describe('/POST transaction', () => {
    let mainnettx = null;
    it('it should create tx on mainnet and tx should verify', (done) => {
      chai.request(server).
        post('/mainnet/transaction').
        send({
          amount: 100000000,
          recipientId: "PFiYxjjF3VhxqWZLGpTzYBrpmkuNHMfK8t",
          passphrase: "This is a test"
        }).
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          res.body.transaction.recipientId.should.equal("PFiYxjjF3VhxqWZLGpTzYBrpmkuNHMfK8t");
          mainnettx = res.body.transaction;
          personajs.crypto.verify(mainnettx).should.be.equal(true);
          done();
        });
    }).timeout(0);

    it('it should broadcast tx on mainnet', (done) => {
      chai.request(server).
        post('/mainnet/broadcast').
        send(mainnettx).
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          done();
        });
    }).timeout(0);

    let devnettx = null;
    it('it should create tx on devnet and tx should verify', (done) => {
      chai.request(server).
        post('/devnet/transaction').
        send({
          amount: 100000000,
          recipientId: "TnGxBjNL9NDXFRjeNEk4gkze2ykYGnYUnF",
          passphrase: "This is a test"
        }).
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          res.body.transaction.recipientId.should.equal("TnGxBjNL9NDXFRjeNEk4gkze2ykYGnYUnF");
          devnettx = res.body.transaction;
          personajs.crypto.verify(devnettx).should.be.equal(true);
          done();
        });
    }).timeout(0);

    it('it should broadcast tx on devnet', (done) => {
      chai.request(server).
        post('/devnet/broadcast').
        send(devnettx).
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          done();
        });
    }).timeout(0);

    it('it should broadcast tx on devnet the old way', (done) => {
      chai.request(server).
        post('/devnet/broadcast').
        send({
          transactions: [devnettx]
        }).
        end((err, res) => {
          res.should.have.status(200);
          res.body.success.should.be.equal(true);
          res.body.transactionIds[0].should.be.equal(devnettx.id);
          done();
        });
    }).timeout(0);


  });

});