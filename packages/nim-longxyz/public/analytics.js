// Import the functions you need from the SDKs you need
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js'
import {
  getAnalytics,
  setAnalyticsCollectionEnabled,
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-analytics.js'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyDcZk_lia7FvGFOtiROJSQ3XR67TwKv1YE',
  authDomain: 'nim-meme-maker.firebaseapp.com',
  projectId: 'nim-meme-maker',
  storageBucket: 'nim-meme-maker.appspot.com',
  messagingSenderId: '588986353453',
  appId: '1:588986353453:web:a6dac8e2308c545bb1f5a4',
  measurementId: 'G-MH115SHSKV',
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const analytics = getAnalytics(app)
setAnalyticsCollectionEnabled(analytics, true)
