import Vue from 'vue';
import axios from 'axios';

import App from './App';
import router from './router';
import store from './store';

if (!process.env.IS_WEB) Vue.use(require('vue-electron'));
Vue.http = Vue.prototype.$http = axios;
Vue.config.productionTip = false;

const config = {
  apiKey: 'AIzaSyA7nyVTExF1TZ5qFqE8wN0RTPWdBZNPJz4',
  authDomain: 'curium-masternode-installer.firebaseapp.com',
  databaseURL: 'https://curium-masternode-installer.firebaseio.com',
  projectId: 'curium-masternode-installer',
  storageBucket: 'curium-masternode-installer.appspot.com',
  messagingSenderId: '661248216725',
};
window.firebase.initializeApp(config);

/* eslint-disable no-new */
new Vue({
  components: { App },
  router,
  store,
  template: '<App/>',
}).$mount('#app');
