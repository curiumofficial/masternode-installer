<template>
  <div id="first-step">
    <p>Currently you have: <span class="amount">{{balance}}</span>XMN</p>
    <p class="mt20" v-if="balance >= 10000">We can continue.</p>
    <p class="mt20" v-if="balance < 10000">We can't continue. You need at least 10000 CRU unlocked on your account.</p>
    <div class="separator"></div>
    <div v-if="balance >= 10000">
      <p>First, we need a good VPS:</p>
      <img src="~@/assets/digitalocean.png" class="do-logo" alt="DigitalOcean" />
      <ul class="buttons">
        <li>
          <button @click="loginWithDigitalOcean()">Login</button>
        </li>
        <li>
          <button @click="openLink($event, 'https://m.do.co/c/7ef716d06656')">Signup</button>
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
import { shell, ipcRenderer } from 'electron';
// import os from 'os';
import fs from 'fs';
import path from 'path';
import userPrompt from 'electron-osx-prompt';
import { setTimeout } from 'timers';
const { dialog } = require('electron').remote;
const Client = require('Curiumn');
const client = new Client({
  username: 'curium',
  password: 'jkdfs87fs78ddf',
  port: 18745,
});

export default {
  data() {
    return {
      outputs: [],
      availableMasternodesToInstall: [],
      currentMasternodes: null,
      xmnaddress: null,
    };
  },
  computed: {
    balance() {
      return this.$store.state.Wallet.balance;
    },
  },
  methods: {
    openLink($event, link) {
      $event.preventDefault();
      shell.openExternal(link);
    },
    getCurrentBalance() {
      client
        .listUnspent()
        .then((unspent) => {
          let balance = 0;
          unspent
            .filter(tx => tx.spendable)
            .forEach((tx) => {
              balance += tx.amount;
            });
          this.$store.commit('SET_BALANCE', {
            balance,
          });
        });
    },
    compareMasternodes() {
      client
        .masternode('outputs')
        .then((response) => {
          // eslint-disable-next-line
          for (const key in response) {
            // eslint-disable-next-line
            if (response.hasOwnProperty(key)) {
              this.outputs.push({
                txid: key,
                txnumber: response[key],
              });
            }
          }

          if (this.outputs.length && this.currentMasternodes) {
            this.availableMasternodesToInstall = this.outputs
              .filter(output => !this.currentMasternodes
                .find(masternode => masternode.txid === output.txid));

            this.installMasternode();
          } else if (!this.outputs.length && !this.currentMasternodes) {
            this.installMasternode();
          }
        });
    },
    installMasternode() {
      if (this.availableMasternodesToInstall.length) {
        // Get first available output
        const output = this.availableMasternodesToInstall[0];
        this.$store.commit('SET_OUTPUT', {
          output,
        });
        // Generate Privkey
        client
          .masternode('genkey')
          .then((genkey) => {
            this.$store.commit('SET_GENKEY', {
              genkey,
            });
            // Start Installation
            this.$store.commit('SET_STEP', {
              currentStep: 2,
            });
          });
      } else {
        console.log('not available masternodes');
        // Create new wallet
        client
          .getNewAddress(this.mnName)
          .then((address) => {
            console.log('New Address Generated', address);
            this.xmnaddress = address;
            // Send 10000 CRU
            client
              .sendToAddress(this.cruaddress, 10000)
              .then((txid) => {
                console.log('txid', txid);
                // Restart Install Masternode
                this.compareMasternodes();
              });
          });
      }
    },
    readCurrentMasternodes(path) {
      this.$store.commit('SET_MNCONFPATH', {
        mnConfPath: path,
      });
      fs.readFile(path, 'utf8', (err, data) => {
        if (err) throw err;
        const lines = data.split('\n');
        this.currentMasternodes = lines
          .filter(line => line[0] !== '#')
          .map((line) => {
            const parts = line.split(' ');
            return {
              name: parts[0],
              ip: parts[1],
              privkey: parts[2],
              txid: parts[3],
              txnumber: parts[4],
            };
          });

        this.compareMasternodes();
      });
    },
    getCurrentMasternodes() {
      let datadirPath = `${this.$store.state.Information.mnConfPath}/masternode.conf`;
      // let datadirPath = `${os.userInfo().homedir}/AppData/Roaming/curiumcru/masternode.conf`;
      // if (os.platform() === 'darwin') {
      //   datadirPath =
      //  `${os.userInfo().homedir}/Library/Application Support/curiumcru/masternode.conf`;
      // }
      // if (os.platform() === 'linux') {
      //   datadirPath = `${os.userInfo().homedir}/.curiumcru/masternode.conf`;
      // }

      if (fs.existsSync(datadirPath)) {
        this.readCurrentMasternodes(datadirPath);
      } else {
        // eslint-disable-next-line
        new window.Notification('Curium Datadir is not the default one', {
          body: 'Please select your Curium Datadir manually',
        });
        setTimeout(() => {
          datadirPath = dialog.showOpenDialog({
            properties: ['openDirectory'],
          });
        }, 1000);
        datadirPath = `${datadirPath}/masternode.conf`;
        if (fs.existsSync(datadirPath)) {
          this.readCurrentMasternodes(datadirPath);
        } else {
          this.getCurrentMasternodes();
        }
      }
    },
    checkForPassphrase() {
      client
        .getInfo()
        .then((info) => {
          if (Object.prototype.hasOwnProperty.call(info, 'unlocked_until')) {
            userPrompt('First, we need to unlock your wallet, please input your Passphrase:',
              'Your Passphrase', path.join(__static, '/icons/256x256.png'))
              .then((input) => {
                if (!input) {
                  this.checkForPassphrase();
                } else {
                  client
                    .walletPassphrase(input, 5000)
                    .then(() => {
                      this.$store.commit('SET_PASSPHRASE', {
                        passphrase: input,
                      });
                    })
                    .catch((error) => {
                      if (error.code === -14) {
                        this.checkForPassphrase();
                      }
                    });
                }
              })
              .catch((err) => {
                console.log(err);
              });
          }
        });
    },
    loginWithDigitalOcean() {
      ipcRenderer.send('do-oauth', 'getToken');
    },
  },
  mounted() {
    this.checkForPassphrase();
    this.getCurrentBalance();
    this.mnName = `MN${Math.round(new Date().getTime() / 1000)}`;
    this.$store.commit('SET_MNNAME', {
      mnName: this.mnName,
    });

    ipcRenderer.on('do-oauth-reply', (event, accessToken) => {
      this.$store.commit('SET_ACCESS_TOKEN', {
        accessToken: accessToken.access_token,
      });
      this.getCurrentMasternodes();
    });
  },
};
</script>

<style lang="scss" scoped>
#first-step {
  margin-top: 30px;
  width: 90%;
}

p {
  font-weight: normal;

  span.amount {
    font-weight: lighter;
    margin-left: 40px;
  }
}

.do-logo {
  margin: 60px auto 20px;
  display: block;
}

ul.buttons {
  list-style: none;
  margin: 50px auto;
  text-align: center;

  li {
    display: inline-block;
    margin-right: 50px;

    &:last-child {
      margin-right: 0;
    }
  }
}
</style>
