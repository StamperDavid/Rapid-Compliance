/**
 * Calendly Integration
 * Appointment scheduling functions
 */

import type { ConnectedIntegration } from '@/types/integrations';

/**
 * Execute a Calendly function
 */
export async function executeCalendlyFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken;
  
  if (!accessToken) {
    throw new Error('Calendly access token not configured');
  }
  
  switch (functionName) {
    case 'checkCalendlyAvailability':
      return await checkAvailability(parameters, accessToken);
      
    case 'bookCalendlyAppointment':
      return await bookAppointment(parameters, accessToken);
      
    default:
      throw new Error(`Unknown Calendly function: ${functionName}`);
  }
}

/**
 * Check available time slots
 */
async function checkAvailability(
  params: {
    date: string;
    eventType?: string;
  },
  accessToken: string
): Promise<Array<{ time: string; available: boolean }>> {
  // Get user's event types
  const userResponse = await fetch('https://api.calendly.com/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  
  if (!userResponse.ok) {
    throw new Error('Failed to fetch Calendly user');
  }
  
  const userData = await userResponse.json();
  const userUri = userData.resource.uri;
  
  // Get event types
  const eventTypesResponse = await fetch(
    `https://api.calendly.com/event_types?user=${userUri}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!eventTypesResponse.ok) {
    throw new Error('Failed to fetch event types');
  }
  
  const eventTypesData = await eventTypesResponse.json();
  const eventType = eventTypesData.collection[0]; // Use first event type
  
  // Get availability for the date
  const startTime = new Date(params.date);
  startTime.setHours(9, 0, 0, 0);
  const endTime = new Date(params.date);
  endTime.setHours(17, 0, 0, 0);
  
  const availabilityResponse = await fetch(
    `https://api.calendly.com/event_type_available_times?event_type=${eventType.uri}&start_time=${startTime.toISOString()}&end_time=${endTime.toISOString()}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  if (!availabilityResponse.ok) {
    throw new Error('Failed to fetch availability');
  }
  
  const availabilityData = await availabilityResponse.json();
  
  return availabilityData.collection.map((slot: any) => ({
    time: new Date(slot.start_time).toLocaleString(),
    available: true,
  }));
}

/**
 * Book an appointment
 */
async function bookAppointment(
  params: {
    datetime: string;
    name: string;
    email: string;
    notes?: string;
  },
  accessToken: string
): Promise<{ scheduledTime: string; confirmationUrl: string }> {
  // Get user's event types
  const userResponse = await fetch('https://api.calendly.com/users/me', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  
  const userData = await userResponse.json();
  const userUri = userData.resource.uri;
  
  // Get event types
  const eventTypesResponse = await fetch(
    `https://api.calendly.com/event_types?user=${userUri}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );
  
  const eventTypesData = await eventTypesResponse.json();
  const eventType = eventTypesData.collection[0];
  
  // Schedule the event
  const scheduleResponse = await fetch('https://api.calendly.com/scheduled_events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType.uri,
      start_time: params.datetime,
      invitee: {
        name: params.name,
        email: params.email,
      },
      questions_and_answers: params.notes ? [
        {
          question: 'Additional Notes',
          answer: params.notes,
        },
      ] : [],
    }),
  });
  
  if (!scheduleResponse.ok) {
    const error = await scheduleResponse.json();
    throw new Error(`Failed to schedule appointment: ${JSON.stringify(error)}`);
  }
  
  const scheduledEvent = await scheduleResponse.json();
  
  return {
    scheduledTime: new Date(scheduledEvent.resource.start_time).toLocaleString(),
    confirmationUrl: scheduledEvent.resource.uri,
  };
}

