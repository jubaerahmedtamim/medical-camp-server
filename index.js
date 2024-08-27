const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config()
const port = process.env.PORT || 5000;


// middlewares
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yatfw0u.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const campCollection = client.db("campDocDB").collection("camp");

    // api for campCollection
    app.post('/camp', async (req, res) => {
      const campInfo = req.body;
      const result = await campCollection.insertOne(campInfo);
      res.send(result)
    })
    app.get('/available-camps', async (req, res) => {
      const result = await campCollection.find().toArray();
      res.send(result)
    })
    app.get('/manage-camps', async (req, res) => {
      const addedBy = req.query.addedBy;
      const query = { addedBy : addedBy }
      const result = await campCollection.find(query).toArray();
      res.send(result);
    })
    app.delete('/manage-camps/:id', async(req, res)=> {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await campCollection.deleteOne(query);
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);




app.get('/', (req, res) => {
  res.send('CampDoc is running...');
})

app.listen(port, () => {
  console.log(`CampDoc is running on port: ${port}`);
})
