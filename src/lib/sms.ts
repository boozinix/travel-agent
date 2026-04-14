import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

export const twilioClient = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!twilioClient || !twilioNumber) {
    console.warn('Twilio client not configured. Mock sending SMS to', to, 'Body:', body);
    return true; // Pretend it succeeded
  }

  try {
    const message = await twilioClient.messages.create({
      body: body,
      from: twilioNumber,
      to: to,
    });
    console.log(`Sent SMS to ${to}, SID: ${message.sid}`);
    return true;
  } catch (error) {
    console.error(`Failed to send SMS to ${to}:`, error);
    return false;
  }
}
