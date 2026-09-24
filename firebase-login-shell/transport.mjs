// Approved Web SDK configuration; no command/repository writer imports.
export async function connect(){
 const [{initializeApp},a,f,{config}]=await Promise.all([
  import('firebase/app'),import('firebase/auth'),import('firebase/firestore'),import('./client-config.mjs')
 ]);
 if(config.projectId!=='naro-biz')throw Object.assign(Error('configuration'),{code:'configuration'});
 const app=initializeApp(config,'login-shell-v185-readonly');
 const auth=a.initializeAuth(app,{persistence:a.inMemoryPersistence});
 const firestore=f.initializeFirestore(app,{localCache:f.memoryLocalCache()});
 return {
  auth,firestore,
  signIn:(email,password)=>a.signInWithEmailAndPassword(auth,email,password),
  signOut:()=>a.signOut(auth),onAuthChanged:callback=>a.onAuthStateChanged(auth,callback)
 };
}
