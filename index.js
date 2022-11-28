const express = require("express");
const app = express();
require("dotenv").config();
const port = process.env.PORT || "5000";
const jwt = require("jsonwebtoken");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.mzkazhr.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

// Verify JWT
function verifyJWT(req, res, next) {
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    const categoriesCollection = client
      .db("used-carz")
      .collection("categories");
    const usersCollection = client.db("used-carz").collection("users");
    const productsCollection = client.db("used-carz").collection("products");
    const bookingsCollection = client.db("used-carz").collection("bookings");
    const reportsCollection = client.db("used-carz").collection("reports");
    const paymentsCollection = client.db("used-carz").collection("payments");
    const blogsCollection = client.db("used-carz").collection("blogs");

    // Admin verify
    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.acting !== "admin") {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // Seller verify
    const verifySeller = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const query = { email: decodedEmail };
      const user = await usersCollection.findOne(query);
      if (user?.acting !== "seller") {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // Create JWT Token
    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1d",
      });
      res.send({ token });
    });

    // Read (Categories)
    app.get("/categories", async (req, res) => {
      const query = {};
      const categories = await categoriesCollection.find(query).toArray();
      res.send(categories);
    });

    // Read (Products)
    app.get("/category/:id", async (req, res) => {
      const id = req.params.id;
      const query = { categoryId: id };
      const products = await productsCollection.find(query).toArray();
      res.send(products);
    });

    // Create (Bookings)
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      const result = await bookingsCollection.insertOne(booking);
      res.send(result);
    });

    // Get/Read (Booking/Orders)
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const query = { buyerEmail: email };
      const bookings = await bookingsCollection.find(query).toArray();

      res.send(bookings);
    });

    // Delete (Booking)
    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Get Bookings (Specific)
    app.get("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const booking = await bookingsCollection.findOne(query);
      res.send(booking);
    });

    // Get Bookings (Specific)
    app.get("/allbookings", async (req, res) => {
      const query = {};
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    });

    // Read (All Products)
    app.get("/myproductsfrombooking", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const query = { sellerEmail: email };
      const products = await bookingsCollection.find(query).toArray();

      res.send(products);
    });

    // Create (User)
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // Read (All Products)
    app.get("/checksellerverify", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const currentUser = await usersCollection.findOne(query);
      res.send(currentUser);
    });

    // Get Admin
    app.get("/users/admin/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isAdmin: user?.acting === "admin" });
    });

    // Get Seller
    app.get("/users/seller/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isSeller: user?.acting === "seller" });
    });

    // Get Buyer
    app.get("/users/buyer/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await usersCollection.findOne(query);
      res.send({ isBuyer: user?.acting === "buyer" });
    });

    // Get Users
    app.get("/users", async (req, res) => {
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users);
    });

    // Get User (Specific)
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const users = await usersCollection.findOne(query);
      res.send(users);
    });

    // Delete (Product)
    app.delete("/users/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
      res.send(result);
    });

    // Update user (acting)
    app.put("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          acting: "admin",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Update user (Verify)
    app.put("/users/verify/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isVerified: true,
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Read (All Products)
    app.get("/myproducts", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email;

      if (email !== decodedEmail) {
        return res.status(403).send({ message: "Forbidden Access" });
      }

      const query = { sellerEmail: email };
      const products = await productsCollection.find(query).toArray();

      res.send(products);
    });

    // Read (Three Products)
    app.get("/products", async (req, res) => {
      const query = { isAdvertised: true };
      const products = await productsCollection
        .find(query)
        .sort({ _id: -1 })
        .toArray();
      res.send(products);
    });

    // Create (Products)
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    });

    // Delete (Product)
    app.delete("/products/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // Update sold Status (Products)
    app.put("/products/sold/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "sold",
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Update Available Status (Products)
    app.put("/products/available/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          status: "available",
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Update Advertise Status (True)
    app.put("/products/makeadvertise/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isAdvertised: true,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Update Advertise Status (false)
    app.put("/products/removeadvertise/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          isAdvertised: false,
        },
      };
      const result = await productsCollection.updateOne(
        filter,
        updatedDoc,
        options
      );
      res.send(result);
    });

    // Create (Reports)
    app.post("/reports", async (req, res) => {
      const report = req.body;
      const result = await reportsCollection.insertOne(report);
      res.send(result);
    });

    // Get (Reports)
    app.get("/reports", async (req, res) => {
      const query = {};
      const reports = await reportsCollection.find(query).toArray();
      res.send(reports);
    });

    // Delete (Report)
    app.delete("/reports/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await reportsCollection.deleteOne(query);
      res.send(result);
    });

    // Create Payment Intent
    app.post("/create-payment-intent", async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Create Payment
    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const result = await paymentsCollection.insertOne(payment);
      const _id = payment.bookingId;
      const filter = { _id: ObjectId(_id) };
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId,
        },
      };
      const updateResult = await bookingsCollection.updateOne(
        filter,
        updatedDoc
      );
      const f = { _id: ObjectId(payment.productId) };
      const updateProduct = await productsCollection.updateOne(f, updatedDoc);

      res.send(result);
    });

    //   READ (Blogs)
    app.get("/blogs", async (req, res) => {
      const query = {};
      const cursor = blogsCollection.find(query);
      const blogs = await cursor.toArray();
      res.send(blogs);
    });
  } catch (error) {
    console.log(error);
  }
}
run();

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.listen(port, () => {
  console.log("Hello World server comes from port: ", port);
});
