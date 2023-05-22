import { Hono } from 'hono';
import { cors } from 'hono/cors';

import validator from 'email-validator';
import escape from 'escape-html';

type Env = {
  MAILTRAIN_PUBLIC_ROOT_PATH: string;
  MAILTRAIN_API_KEY: string;
  MAILTRAIN_CONTACT_TEMPLATE_CID: string;
  MAILTRAIN_MAILING_LIST_ID: string;
  CONTACT_EMAIL: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin.endsWith('.hackthe6ix.com') ? origin : 'https://hackthe6ix.com',
    allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  })
);

app.post('/api/subscribe', async (c) => {
  const body = await c.req.json();

  try {
    const { email } = body;
    const mailingListCID = c.env.MAILTRAIN_MAILING_LIST_ID;

    console.log(`[${new Date()}] New subscription: ${JSON.stringify(body)}`);

    if (!email || !validator.validate(email)) {
      console.log(
        `[${new Date()} - Subscribe] Error: Invalid request - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(400);
      return c.text('Invalid request! Must specify valid email!');
    }

    // STEP 1: Fetch the user's current subscriptions and verify they haven't already subscribed
    const resultGetSubscriptions = await fetch(
      `${c.env.MAILTRAIN_PUBLIC_ROOT_PATH}/api/lists/${email}?access_token=${c.env.MAILTRAIN_API_KEY}`
    );
    const resultGetSubscriptionsData =
      (await resultGetSubscriptions.json()) as any;

    if (resultGetSubscriptions.status != 200 || !resultGetSubscriptionsData) {
      console.log(
        `[${new Date()} - Subscribe] Error: Mailtrain error - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    for (const sub of resultGetSubscriptionsData.data) {
      if (sub.cid === mailingListCID && sub.status == 1) {
        c.status(400);
        return c.text('You have already subscribed!');
      }
    }

    // STEP 2: Subscribe the user
    const resultSubscribe = await fetch(
      `${c.env.MAILTRAIN_PUBLIC_ROOT_PATH}/api/subscribe/${mailingListCID}?access_token=${c.env.MAILTRAIN_API_KEY}`,
      {
        body: new URLSearchParams({
          EMAIL: email,
          REQUIRE_CONFIRMATION: 'false',
          FORCE_SUBSCRIBE: 'true',
        }),
        method: 'POST',
      }
    );

    if (
      resultSubscribe.status != 200 ||
      !((await resultSubscribe.json()) as any)?.data?.id
    ) {
      console.log(
        `[${new Date()} - Subscribe] Error: Mailtrain error - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    return c.text('You have subscribed successfully!');
  } catch (e) {
    console.log(
      `[${new Date()} - Subscribe] Error: ${e} - Request: ${JSON.stringify(
        body
      )}`
    );
    c.status(500);
    return c.text('Something went wrong - please try again later');
  }
});

app.post('/api/contact', async (c) => {
  const body = await c.req.json();

  try {
    const { name, email, message } = body;

    console.log(
      `[${new Date()}] New contact form message: ${JSON.stringify(body)}`
    );

    if (!name || !email || !validator.validate(email) || !message) {
      console.log(
        `[${new Date()} - Contact form] Error: Invalid request - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(400);
      return c.text('Invalid request! Must specify name, email, and message!');
    }

    if (name.length > 128 || email.length > 128 || message.length > 2056) {
      console.log(
        `[${new Date()} - Contact form] Error: Message length exceeded - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(400);
      return c.text('Invalid request! Maximum message length exceeded!');
    }

    const tags: any = {
      'TAGS[USER_NAME]': escape(name),
      'TAGS[USER_EMAIL]': escape(email),
      'TAGS[BODY]': escape(message),
    };

    const result = await fetch(
      `${c.env.MAILTRAIN_PUBLIC_ROOT_PATH}/api/templates/${c.env.MAILTRAIN_CONTACT_TEMPLATE_CID}/send?access_token=${c.env.MAILTRAIN_API_KEY}`,
      {
        body: new URLSearchParams({
          EMAIL: c.env.CONTACT_EMAIL,
          SUBJECT: 'Contact form message from ' + escape(name),
          ...tags,
        }),
        method: 'POST',
      }
    );

    if (result.status != 200) {
      console.log(
        `[${new Date()} - Contact form] Error: Mailtrain error - Request: ${JSON.stringify(
          body
        )}`
      );
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    return c.text('Your message has been sent!');
  } catch (e) {
    console.log(
      `[${new Date()} - Contact form] Error: ${e} - Request: ${JSON.stringify(
        body
      )}`
    );
    c.status(500);
    return c.text('Something went wrong - please try again later');
  }
});

export default app;
