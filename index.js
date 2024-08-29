const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const usersCollection = client.db("campDocDB").collection("users");
    const registeredCampsCollection = client.db("campDocDB").collection("registeredCamps");
    const paymentsCollection = client.db("campDocDB").collection("payments");

    // jwt related apis
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token });
    })

    // middlewares 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access." })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access." })
        }
        req.decoded = decoded;
        next();
      })
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next()
    }

    // api for registeredCampsCollection
    app.post('/registered-camps', async (req, res) => {
      const registerCamp = req.body;
      const result = await registeredCampsCollection.insertOne(registerCamp);
      res.send(result);
    })
    app.patch('/update-registered-camp/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          payment_status: 'paid'
        }
      }
      const result = await registeredCampsCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    //update confirmation by admin
    app.patch('/update-registered-camp-confirmation/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
            confirmation_status: 'Confirmed',
        }
      }
      const result = await registeredCampsCollection.updateOne(filter, updateDoc);
      res.send(result)
    })
    app.delete('/delete-registered-camp/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await registeredCampsCollection.deleteOne(query);
      res.send(result)
    })

    app.get('/registered-camp/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await registeredCampsCollection.findOne(query);
      res.send(result);
    })

    // get all registered camps by all users
    app.get('/registered-camps', verifyToken, verifyAdmin, async (req, res) => {
      const result = await registeredCampsCollection.find().toArray();
      res.send(result);
    })

    // get specified user by email
    app.get('/registered-camps', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await registeredCampsCollection.find(query).toArray();
      res.send(result);
    })


    // api for usersCollection.
    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      console.log(req.decoded.email);
      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: 'unauthorized access' })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin })
    })

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'user already exists', insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    })

    app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    // api for campCollection
    app.post('/camp', verifyToken, verifyAdmin, async (req, res) => {
      const campInfo = req.body;
      const result = await campCollection.insertOne(campInfo);
      res.send(result)
    })
    app.get('/available-camps', async (req, res) => {
      const result = await campCollection.find().toArray();
      res.send(result)
    })
    app.get('/manage-camps', verifyToken, verifyAdmin, async (req, res) => {
      const addedBy = req.query.addedBy;
      const query = { addedBy: addedBy }
      const result = await campCollection.find(query).toArray();
      res.send(result);
    })
    // camp-details api
    app.get('/manage-camp/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.findOne(query);
      res.send(result);
    })
    app.delete('/manage-camps/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campCollection.deleteOne(query);
      res.send(result);
    })
    app.put('/update-camp/:id', verifyToken, verifyAdmin, async (req, res) => {
      const campInfo = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          campName: campInfo.campName,
          campFees: campInfo.campFees,
          location: campInfo.location,
          professionalName: campInfo.professionalName,
          date: campInfo.date,
          time: campInfo.time,
          details: campInfo.details,
          image_url: campInfo.image_url,
        }
      }
      const result = await campCollection.updateOne(filter, updateDoc)
      res.send(result);
    })

    //payment
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      })
      res.send({
        clientSecret: paymentIntent.client_secret,
      })
    })

    app.post('/payments', async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      res.send(result);
    })

    app.get('/payments', async (req, res) => {
      const email = req.query.email;
      let query = { email: email }
      const result = await paymentsCollection.find(query).toArray();
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
