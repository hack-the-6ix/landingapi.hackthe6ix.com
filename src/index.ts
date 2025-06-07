import { Hono } from 'hono';
import { cors } from 'hono/cors';

import validator from 'email-validator';
import escape from 'escape-html';

type Env = {
  LISTMONK_API_URL: string;
  LISTMONK_API_USERNAME: string;
  LISTMONK_API_PASSWORD: string;
  LISTMONK_SUBSCRIBE_LIST_ID: string;
  LISTMONK_CONTACT_TEMPLATE_ID: string;
  CONTACT_EMAIL: string;
  CAPTCHA_SECRET_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use(
  '/api/*',
  cors({
    origin: (origin) =>
      origin.endsWith('.hackthe6ix.com') ? origin : 'https://hackthe6ix.com',
    allowMethods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  }),
);

app.post('/api/subscribe', async (c) => {
  const body = await c.req.json();

  try {
    const { email } = body;
    const listId = parseInt(c.env.LISTMONK_SUBSCRIBE_LIST_ID);
    const listmonkUrl = c.env.LISTMONK_API_URL;
    const listmonkUser = c.env.LISTMONK_API_USERNAME;
    const listmonkPass = c.env.LISTMONK_API_PASSWORD;

    const authHeader = `Basic ${btoa(`${listmonkUser}:${listmonkPass}`)}`;

    console.log(`[${new Date()}] New subscription: ${JSON.stringify(body)}`);

    if (!email || !validator.validate(email)) {
      console.log(
        `[${new Date()} - Subscribe] Error: Invalid request - Request: ${JSON.stringify(
          body,
        )}`,
      );
      c.status(400);
      return c.text('Invalid request! Must specify valid email!');
    }

    // STEP 1: Find or create the subscriber
    const getSubResponse = await fetch(
      `${listmonkUrl}/api/subscribers?query=email='${email}'`,
      {
        headers: {
          Authorization: authHeader,
        },
      },
    );

    if (getSubResponse.status !== 200) {
      console.log(
        `[${new Date()} - Subscribe] Error: Listmonk error - Request: ${JSON.stringify(
          body,
        )}`,
      );
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    let subscriber = ((await getSubResponse.json()) as any)?.data?.results?.[0];
    if (!subscriber) {
      // Create the subscriber if they don't exist
      const createSubResponse = await fetch(`${listmonkUrl}/api/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          email: email,
          name: email,
          status: 'enabled',
        }),
      });

      if (createSubResponse.status !== 200) {
        console.log(
          `[${new Date()} - Subscribe] Error: Listmonk error (create) - Request: ${JSON.stringify(
            body,
          )}`,
        );
        c.status(500);
        return c.text('Mail server failure - please try again later');
      }

      subscriber = ((await createSubResponse.json()) as any)?.data;
    }

    // STEP 2: Add subscriber to the list
    if (subscriber.lists.some((l: any) => l.id === listId)) {
      c.status(400);
      return c.text('You have already subscribed!');
    }

    const resultUpdateSubscription = await fetch(
      `${listmonkUrl}/api/subscribers/lists`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify({
          ids: [subscriber.id],
          action: 'add',
          target_list_ids: [listId],
          status: 'confirmed', // should be unconfirmed if the list is double opt-in
        }),
      },
    );

    if (resultUpdateSubscription.status !== 200) {
      console.log(
        `[${new Date()} - Subscribe] Error: Listmonk error (update) - Request: ${JSON.stringify(
          body,
        )}`,
      );
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    // STEP 3: Send opt-in email
    // const optinResponse = await fetch(
    //   `${listmonkUrl}/api/subscribers/${subscriber.id}/optin`,
    //   {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       Authorization: authHeader,
    //     },
    //     body: JSON.stringify({}),
    //   }
    // );

    // if (optinResponse.status !== 200) {
    //   console.log(
    //     `[${new Date()} - Subscribe] Error: Listmonk error (opt-in) - Request: ${JSON.stringify(
    //       body
    //     )}`
    //   );
    //   c.status(500);
    //   return c.text('Mail server failure - please try again later');
    // }

    // return c.text(
    //   'You have subscribed successfully! Please check your email to confirm your subscription.'
    // );
    return c.text('You have subscribed successfully!');
  } catch (e) {
    console.log(
      `[${new Date()} - Subscribe] Error: ${e} - Request: ${JSON.stringify(
        body,
      )}`,
    );
    c.status(500);
    return c.text('Something went wrong - please try again later');
  }
});

app.post('/api/contact', async (c) => {
  const body = await c.req.json();

  try {
    const { name, email, message, captchaToken } = body;
    const listmonkUrl = c.env.LISTMONK_API_URL;
    const listmonkUser = c.env.LISTMONK_API_USERNAME;
    const listmonkPass = c.env.LISTMONK_API_PASSWORD;

    const authHeader = `Basic ${btoa(`${listmonkUser}:${listmonkPass}`)}`;

    console.log(
      `[${new Date()}] New contact form message: ${JSON.stringify(body)}`,
    );

    if(!captchaToken) {
      c.status(400);
      return c.text('Invalid request! No captcha token specified.');
    }

    const ip = c.req.header('CF-Connecting-IP')!!;

    // Validate the token by calling the "/siteverify" API.
    const verifyTokenData = new FormData();
    verifyTokenData.append('secret', c.env.CAPTCHA_SECRET_KEY);
    verifyTokenData.append('response', captchaToken);
    verifyTokenData.append('remoteip', ip);

    const verifyTokenResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      body: verifyTokenData,
      method: 'POST',
    });

    const verifyTokenResult = await verifyTokenResponse.json() as any;

    if(!verifyTokenResult.success) {
      c.status(400);
      return c.text("Invalid Captcha token!");
    }

    if (!name || !email || !validator.validate(email) || !message) {
      console.log(
        `[${new Date()} - Contact form] Error: Invalid request - Request: ${JSON.stringify(
          body,
        )}`,
      );
      c.status(400);
      return c.text('Invalid request! Must specify name, email, and message!');
    }

    if (name.length > 128 || email.length > 128 || message.length > 2056) {
      console.log(
        `[${new Date()} - Contact form] Error: Message length exceeded - Request: ${JSON.stringify(
          body,
        )}`,
      );
      c.status(400);
      return c.text('Invalid request! Maximum message length exceeded!');
    }

    const result = await fetch(`${listmonkUrl}/api/tx`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        subscriber_email: c.env.CONTACT_EMAIL,
        template_id: parseInt(c.env.LISTMONK_CONTACT_TEMPLATE_ID),
        data: {
          name: escape(name),
          email: escape(email),
          message: escape(message),
        },
      }),
      method: 'POST',
    });

    if (result.status != 200) {
      console.log(
        `[${new Date()} - Contact form] Error: Listmonk error - Request: ${JSON.stringify(
          body,
        )}`,
      );
      console.log(await result.text());
      c.status(500);
      return c.text('Mail server failure - please try again later');
    }

    return c.text('Your message has been sent!');
  } catch (e) {
    console.log(
      `[${new Date()} - Contact form] Error: ${e} - Request: ${JSON.stringify(
        body,
      )}`,
    );
    c.status(500);
    return c.text('Something went wrong - please try again later');
  }
});

export default app;
