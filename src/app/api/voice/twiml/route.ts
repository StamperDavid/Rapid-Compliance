import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/voice/twiml
 * TwiML response for voice calls
 */
export async function GET(request: NextRequest) {
  // Simple TwiML response - can be customized per organization
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Hello! This is a call from your CRM system. Please hold while we connect you.</Say>
  <Pause length="1"/>
  <Say voice="alice">If you'd like to be removed from our calling list, please press 1.</Say>
  <Gather numDigits="1" action="/api/voice/gather">
    <Say voice="alice">Otherwise, please hold.</Say>
  </Gather>
</Response>`;

  return new NextResponse(twiml, {
    headers: {
      'Content-Type': 'text/xml',
    },
  });
}



