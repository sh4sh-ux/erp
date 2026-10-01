// Explicit LOCAL build. The release builder replaces this module, not a URL flag.
import {mockAuth,mockCloud} from './mock.mjs';
export async function createRuntime(){return {auth:mockAuth(),cloud:mockCloud()};}
