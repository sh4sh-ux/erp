// SDK injection keeps mock builds offline. Cloud wiring requires a separately approved build.
// No Firestore or provider secrets. Caller supplies an isolated named Firebase app.
export function createFirebaseAuth(sdk,app) {
 const auth=sdk.initializeAuth(app,{persistence:sdk.inMemoryPersistence});
 const identity=user=>user?{uid:user.uid,emailVerified:user.emailVerified===true}:null;
 return {
  async signup(email,password){const result=await sdk.createUserWithEmailAndPassword(auth,email,password);return identity(result.user);},
  async login(email,password){const result=await sdk.signInWithEmailAndPassword(auth,email,password);return identity(result.user);},
  async sendVerification(){if(!auth.currentUser)throw Object.assign(Error('SESSION_EXPIRED'),{code:'SESSION_EXPIRED'});await sdk.sendEmailVerification(auth.currentUser);},
  async reload(){if(!auth.currentUser)return null;await sdk.reload(auth.currentUser);return identity(auth.currentUser);},
  async reset(email){try{await sdk.sendPasswordResetEmail(auth,email);}catch(e){if(e.code!=='auth/user-not-found')throw e;}},
  async logout(){await sdk.signOut(auth);}
 };
}
