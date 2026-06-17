import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAR2o23QZgZcIyL0Y9QwJ-M8ye7Hrh9vRg",
  authDomain: "chatbot-clone-723d7.firebaseapp.com",
  projectId: "chatbot-clone-723d7",
  storageBucket: "chatbot-clone-723d7.firebasestorage.app",
  messagingSenderId: "184158473461",
  appId: "1:184158473461:web:31cee0fe80bf821b4c49bc",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
