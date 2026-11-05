import { env } from 'cloudflare:workers';
// @ts-ignore JavaScript room service is shared with the Worker integration tests.
import { handleRoom } from '../../../lib/room.mjs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return handleRoom(request,env.DB);}
