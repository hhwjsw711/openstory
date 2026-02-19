import type { Party, PartyKitServer, Connection } from 'partykit/server';

/**
 * PartyKit server for real-time event broadcasting.
 *
 * - Workflows POST events via HTTP (authenticated with PARTY_AUTH_TOKEN)
 * - Browser clients connect via WebSocket and receive broadcasts
 * - Room IDs map to channel names: sequenceId or talent:{talentId}
 */
export default {
  async onConnect(_connection: Connection, _room: Party) {
    // Client connected — nothing to do, they'll receive broadcasts
  },

  async onRequest(request: Request, room: Party) {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // Authenticate server-to-server POSTs
    const authToken = String(room.env.PARTY_AUTH_TOKEN ?? '');
    if (authToken) {
      const header = request.headers.get('Authorization');
      if (header !== `Bearer ${authToken}`) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // Broadcast the event payload to all connected WebSocket clients
    const payload = await request.text();
    room.broadcast(payload);

    return new Response('OK', { status: 200 });
  },
} satisfies PartyKitServer;
