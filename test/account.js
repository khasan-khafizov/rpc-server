// Require the dev-dependencies
const chai = require('chai');
const chaiHttp = require('chai-http');
const server = require('../server');
const personajs = require('personajs');
const bip39 = require('bip39');

chai.should();
chai.use(chaiHttp);



describe('Accounts', () => {

    describe('/GET account', () => {
      it('it should GET account with a given address on mainnet', (done) => {
      chai.request(server).
      get('/mainnet/account/PFiYxjjF3VhxqWZLGpTzYBrpmkuNHMfK8t').
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.account.address.should.be.equal("PFiYxjjF3VhxqWZLGpTzYBrpmkuNHMfK8t");
        done();
      });
    }).timeout(0);

    it('it should GET account with a given address on testnet', (done) => {
      chai.request(server).
      get('/testnet/account/TeXVihzdph4TT39kdaoLZTu8LFx87emYos').
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.account.address.should.be.equal("TeXVihzdph4TT39kdaoLZTu8LFx87emYos");
        done();
      });
    }).timeout(0);

    // it('STRESSTEST: it should GET 50000 accounts on testnet', (done) => {
    //   for(var i=0; i<50000; i++){
    //     var address = personajs.crypto.getKeys(bip39.generateMnemonic()).getAddress();
    //     chai.request(server).
    //     get('/testnet/account/'+address).
    //     end((err, res) => {
    //       res.should.have.status(200);
    //       res.body.success.should.be.equal(true);
    //       res.body.account.address.should.be.equal(address);
    //       done();
    //     });
    //   }

    // });
  });

  describe('/POST account', () => {
    it('it should create an account on mainnet', (done) => {
      chai.request(server).
      post('/mainnet/account').
      send({
        passphrase: "this is a test"
      }).
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.account.address.should.be.equal("PMSUSwFQhCe7M8S3maaA3v5ii9ZT4RHTmk");
        res.body.account.publicKey.should.be.equal("03675c61dcc23eab75f9948c6510b54d34fced4a73d3c9f2132c76a29750e7a614");
        done();
      });
    }).timeout(0);

    var bip38address = null;
    var bip38backup = null;
    var userid = require('crypto').randomBytes(32).toString("hex");

    it('it should create an account on mainnet using bip38 encryption', (done) => {
      chai.request(server).
      post('/mainnet/account/bip38').
      send({
        bip38: "master password",
        userid
      }).
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.should.have.property('address');
        res.body.should.have.property('wif');
        bip38address = res.body.address;
        bip38backup = res.body.wif;
        done();
      });
    }).timeout(0);

    it('it should find bip38 backup from userid', (done) => {
      chai.request(server).
      get(`/mainnet/account/bip38/${userid}`).
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.should.have.property('wif');
        bip38backup = res.body.wif.should.equal(bip38backup);
        done();
      });
    }).timeout(0);

    it('it should create transaction from bip38 backup using userid', (done) => {
      chai.request(server).
      post('/mainnet/transaction/bip38').
      send({
        bip38: "master password",
        userid,
        amount: 1000000000,
        recipientId: "PMSUSwFQhCe7M8S3maaA3v5ii9ZT4RHTmk"
      }).
      end((err, res) => {
        process.stdout.write(".");
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.transaction.recipientId.should.equal("PMSUSwFQhCe7M8S3maaA3v5ii9ZT4RHTmk");
        personajs.crypto.verify(res.body.transaction).should.be.equal(true);
        done();
      });
    }).timeout(0);

    it('it should create an account on testnet', (done) => {
      chai.request(server).
      post('/testnet/account').
      send({
        passphrase: "this is a test"
      }).
      end((err, res) => {
        res.should.have.status(200);
        res.body.success.should.be.equal(true);
        res.body.account.address.should.be.equal("TnA7H8XaWBjkLty13CEfPJ5NdhPprxGKnP");
        res.body.account.publicKey.should.be.equal("03675c61dcc23eab75f9948c6510b54d34fced4a73d3c9f2132c76a29750e7a614");
        done();
      });
    }).timeout(0);
  });

});
