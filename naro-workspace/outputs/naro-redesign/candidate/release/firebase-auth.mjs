// SDK injection keeps mock builds offline. Cloud wiring requires a separately approved build.
// No Firestore or provider secrets. Caller supplies an isolated named Firebase app.
export function createFirebaseAuth(sdk,app,preferenceStorage=()=>globalThis.localStorage) {
 // Only an explicitly remembered login writes persistent Firebase credentials.
 // Initial LOCAL allows restoring that prior opt-in; all new sign-ins set policy first.
 const auth=sdk.initializeAuth(app,{persistence:sdk.browserLocalPersistence||sdk.inMemoryPersistence});
 const identity=user=>user?{uid:user.uid,emailVerified:user.emailVerified===true}:null;
 const preferenceKey=()=>auth.currentUser?.uid?'naro.provider.v1:'+auth.currentUser.uid:null;
 return {
  currentIdentity(){return identity(auth.currentUser);},
  preferredProvider(){try{const key=preferenceKey(),value=key?preferenceStorage()?.getItem(key):null;return ['drive','dropbox'].includes(value)?value:null;}catch{return null;}},
  rememberProvider(kind){if(!['drive','dropbox'].includes(kind))return;try{const key=preferenceKey();if(key)preferenceStorage()?.setItem(key,kind);}catch{/* Preference failure never blocks sign-in. */}},
  async signup(email,password){await sdk.setPersistence?.(auth,sdk.inMemoryPersistence);const result=await sdk.createUserWithEmailAndPassword(auth,email,password);return identity(result.user);},
  async login(email,password,{remember=false}={}){await sdk.setPersistence(auth,remember?sdk.browserLocalPersistence:sdk.inMemoryPersistence);const result=await sdk.signInWithEmailAndPassword(auth,email,password);return identity(result.user);},
  async restore(){await auth.authStateReady();if(!auth.currentUser)return null;await sdk.reload(auth.currentUser);return identity(auth.currentUser);},
  watch(fn){return sdk.onAuthStateChanged(auth,user=>fn(identity(user)));},
  async sendVerification(){if(!auth.currentUser)throw Object.assign(Error('SESSION_EXPIRED'),{code:'SESSION_EXPIRED'});await sdk.sendEmailVerification(auth.currentUser);},
  async reload(){if(!auth.currentUser)return null;await sdk.reload(auth.currentUser);return identity(auth.currentUser);},
  async reset(email){try{await sdk.sendPasswordResetEmail(auth,email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}},
  async logout(){await sdk.signOut(auth);}
 };
}
