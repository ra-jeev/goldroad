importScripts('/__/firebase/9.17.1/firebase-app-compat.js');
importScripts('/__/firebase/9.17.1/firebase-messaging-compat.js');
importScripts('/__/firebase/init.js');

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log('Received background message ');
  // Customize notification here
  // const notificationTitle = payload.notification.title;
  // const notificationOptions = {
  //   body: payload.notification.body,
  //   icon: payload.notification.icon || '/icon-512.png',
  // };

  // self.registration.showNotification(notificationTitle, notificationOptions);
});
