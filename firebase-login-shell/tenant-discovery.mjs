// Discovery hints never substitute for membership authorization.
import {collection, doc, getDocsFromServer, getDocFromServer} from 'firebase/firestore';

export async function discoverTenants({auth, firestore}, uid = auth.currentUser?.uid) {
  const error = code => ({status:'DISCOVERY_ERROR', code, tenants:[]});
  if (!uid || auth.currentUser?.uid !== uid) return error('unauthenticated');
  try {
    const entries = await getDocsFromServer(collection(firestore, 'users', uid, 'tenants'));
    const tenants = [];
    for (const entry of entries.docs) {
      // Path is canonical. Optional legacy/redundant tenantId must agree.
      const data = entry.data();
      if ('tenantId' in data && data.tenantId !== entry.id) return error('invalid-discovery-entry');
      let membership;
      try {
        membership = await getDocFromServer(doc(firestore, 'tenants', entry.id, 'members', uid));
      } catch (e) {
        // Existing owner-only Rules deny stale/non-owner hints. Never grant them.
        if (e.code === 'permission-denied') continue;
        throw e;
      }
      if (membership.exists() && membership.id === uid && membership.data().role === 'owner') {
        tenants.push(entry.id);
      }
    }
    if (auth.currentUser?.uid !== uid) return error('auth-changed');
    return {status:tenants.length === 0 ? 'NO_TENANT' : tenants.length === 1 ? 'SINGLE_TENANT' : 'MULTIPLE_TENANTS', tenants};
  } catch (e) {
    return error(typeof e.code === 'string' ? e.code : 'discovery-failed');
  }
}
