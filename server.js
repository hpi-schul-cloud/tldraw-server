const WebSocket = require('ws')
const http = require('http')
const setupWSConnection = require('./utils.js')
const Y = require('yjs');
const express = require('express');
const MongoClient = require('mongodb');
const cors = require('cors');
const MongodbPersistence = require('y-mongodb-provider');

const wsPort = 3333;
const host = 'localhost';

// Mongo
const connectionString = "mongodb://localhost:27017/schulcloud";
const mongoClient = new MongoClient.MongoClient(connectionString);
const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({noServer: true})
wss.on('connection', (socket, request, user) => {
    setupWSConnection.setupWSConnection(socket, request, user);
});

app.use(express.json());
app.use(cors());

const mdb = new MongodbPersistence.MongodbPersistence(connectionString, {
    collectionName: 'docs',
    flushSize: 400,
    multipleCollections: false,
});

/*
 Persistence must have the following signature:
{ bindState: function(string,WSSharedDoc):void, writeState:function(string,WSSharedDoc):Promise }
*/
setupWSConnection.setPersistence({
    bindState: async (docName, ydoc) => {
        // Here you listen to granular document updates and store them in the database
        // You don't have to do this, but it ensures that you don't lose content when the server crashes
        // See https://github.com/yjs/yjs#Document-Updates for documentation on how to encode
        // document updates

        const persistedYdoc = await mdb.getYDoc(docName);
        const persistedStateVector = Y.encodeStateVector(persistedYdoc);
        const diff = Y.encodeStateAsUpdate(ydoc, persistedStateVector);

        if (diff.reduce((previousValue, currentValue) => previousValue + currentValue, 0) > 0) {
            mdb.storeUpdate(docName, diff);
        }

        Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(persistedYdoc));

        ydoc.on("update", async update => {
            mdb.storeUpdate(docName, update);
        });

        persistedYdoc.destroy();
    },
    writeState: async (docName, ydoc) => {
        // This is called when all connections to the document are closed.

        await mdb.flushDocument(docName);
    }
})

server.on('upgrade', (request, socket, head) => {
    const handleAuth = ws => {
        wss.emit('connection', ws, request)
    }
    wss.handleUpgrade(request, socket, head, handleAuth)
});

server.listen(wsPort, host, () => {
    console.log(`running at '${host}' on port ${wsPort}`)
});

app.post("/paintings", async (req, res) => {
    try {
        const paintingData = req.body;
        console.log(paintingData)
        const collection = mongoClient.db().collection("paintings");
        const result = await collection.insertOne(paintingData);
        res.json({id: result.insertedId});
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
});
