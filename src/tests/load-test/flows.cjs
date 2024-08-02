const domain = 'localhost';
const uri = `http://${domain}:3046/tldraw?roomName=66ac7ce23384ebd837ddb05e`;
let jwt = ''

async function checkLoadOnTldrawDocument(
  page,
  userContext,
  events,
  test
) {
  await test.step('get jwt from api server', async () => {
    const response = await fetch(`http://${domain}:3030/api/v3/authentication/local`, {
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
    const textElement = await page.locator('#TD-PrimaryTools-Text');
    await textElement.click();

    const boardElement = await page.locator('#tl');
    await boardElement.click();

    await page.keyboard.type('Hello Tldraw!');
  });
}

module.exports = {
  checkLoadOnTldrawDocument,
};