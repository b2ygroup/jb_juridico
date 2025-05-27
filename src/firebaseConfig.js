// Importações do Firebase (SDK v9+)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <<< IMPORTAR getStorage

// Suas credenciais do Firebase (substitua pelos seus valores reais)
const firebaseConfig = {
  apiKey: "AIzaSyAPKCQ7zUAzOK2PNYZwJ71mAVjT88EHHyA",
  authDomain: "jb-juridico.firebaseapp.com",
  projectId: "jb-juridico",
  storageBucket: "jb-juridico.firebasestorage.app",
  messagingSenderId: "942593017263",
  appId: "1:942593017263:web:8f9f8023bf56ead0a11b5a",
  measurementId: "G-6PP1BW7WNT"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Inicializar serviços do Firebase
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app); // <<< INICIALIZAR E EXPORTAR STORAGE

// Exportar os serviços para usar em outros lugares da aplicação
export { auth, db, storage }; // <<< ADICIONAR storage AOS EXPORTS