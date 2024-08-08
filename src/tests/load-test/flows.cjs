const protocol = 'https';
//const protocol = 'http';
const domain = 'bc-7674.dbc.dbildungscloud.dev';
//const domain = 'localhost:3046';
const roomName='66b4764e9f88c3c36eb0e772'
//const roomName = '66b23c09446529d7fcdf04ec'
const uri = `${protocol}://${domain}/tldraw?roomName=${roomName}`;
let jwt = ''

async function checkLoadOnTldrawDocument(
  page,
  userContext,
  events,
  test
) {
  await test.step('get jwt from api server', async () => {
    const response = await fetch(`${protocol}://${domain}/api/v3/authentication/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        {
          username: "lehrer@schul-cloud.org",
          password: "Schulcloud1!"
        }
      )
    });

    const { accessToken } = await response.json();
    jwt = accessToken;
  });

  await test.step('Go to tldraw document', async () => {
    const browserContext = page.context();
    await browserContext.addCookies([
      { name: 'jwt', value: jwt, path: '/', domain }
    ]);
    const requestPromise = page.waitForRequest(uri);
    await page.goto(uri);
    await requestPromise;
  });
  await test.step('Write a text on board', async () => {
   // await page.waitForTimeout(4000);

    const textElement = await page.locator('#TD-PrimaryTools-Text');
    await textElement.click();

    await page.mouse.move(100, 100);

    const boardElement = await page.locator('#tl');
    await boardElement.click();

    const date = new Date();
    await page.keyboard.type('Hello Tldraw! ' + date.toLocaleString());
    await page.waitForTimeout(40000);
  });
}

module.exports = {
  checkLoadOnTldrawDocument,
};