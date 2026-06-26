const dns = require("node:dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const cors = require("cors");
const express = require('express');
const app = express();

const port = process.env.PORT || 5000;
const Stripe = require("stripe");
app.use(cors());
require("dotenv").config();
app.use(express.json());
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const uri =process.env.MONGO_DB_URI;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
app.get('/', (req, res) => {
  res.send('Hello World!');
});



const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
const JWKS = createRemoteJWKSet(
new URL(`${process.env.BETTER_AUTH_URL}/api/auth/jwks`)

)

   
const verifyToken = async (req, res, next) => {

  try {
    const authHeader = req.headers.authorization;
    

    const token = authHeader.split(" ")[1];
   

    const { payload } = await jwtVerify(token, JWKS);

  
    req.user = payload;

    next();
  } catch (err) {
   

    return res.status(403).json({
      message: "Forbidden",
    });
  }
};
const verifyAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Forbidden",
    });
    console.log(JSON.stringify(req.user, null, 2));
  }

  next();
};
const verifybuyer= (req, res, next) => {  console.log("JWT user:", req.user);
  console.log("Role:", req.user.role);
  if (req.user.role !== "buyer") {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  next();
};
const verifyseller= (req, res, next) => {
  if (req.user.role !== "seller") {
    return res.status(403).json({
      message: "Forbidden",
    });
  }

  next();
};
// async function run() {
//   try {
    
//     await client.connect();


client.connect(()=>{

}).catch(console.dir)
    const database = client.db("resell-hub");
    const productCollection= database.collection("product");
    const userCollection= database.collection("user");
    const orderCollection= database.collection("order");
    const wishlistCollection =
  database.collection("wishlist");
  const paymentCollection = database.collection("payment");
  const reportCollection = database.collection("report")




 app.post("/api/product",verifyToken,verifyseller, async(req,res)=>{
    const product= req.body;
    const result= await productCollection.insertOne(product);
    res.send(result)
 })
app.get("/api/all/product", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;

    const search = req.query.search || "";
    const category = req.query.category || "";
    const condition = req.query.condition || "";

    const query = {};

    if (search) {
      query.title = {
        $regex: search,
        $options: "i",
      };
    }

    if (category) {
      query.category = category;
    }

    if (condition) {
      query.condition = condition;
    }

    const skip = (page - 1) * limit;

    const total = await productCollection.countDocuments(query);

    const products = await productCollection
      .find(query)
      .sort({ _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    res.send({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: "Failed to fetch products",
    });
  }
});
app.get("/api/all/product2", async (req, res) => {
  const products = await productCollection
    .find({})
    .sort({ _id: -1 })
    .limit(8)
    .toArray();

  res.send(products);
});
app.get("/api/all/product/:id", async (req, res) => {
  try {
    const id = req.params.id;

    // 1. Validate ObjectId (VERY IMPORTANT)
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid product id",
      });
    }

    // 2. Fetch product
    const product = await productCollection.findOne({
      _id: new ObjectId(id),
    });

    // 3. Handle not found
    if (!product) {
      return res.status(404).send({
        message: "Product not found",
      });
    }

    // 4. Send consistent response shape
    res.status(200).send({
      product,
    });

  } catch (error) {
    console.error("GET PRODUCT BY ID ERROR:", error);

    res.status(500).send({
      message: "Failed to fetch product",
    });
  }
});
app.get("/api/product", async(req,res)=>{
   const query={};
   const {
    sellerId,
    stock,
    search,
    category,
    condition,
  } = req.query;

  if (sellerId) {
    query.sellerId = sellerId;
  }

  if (stock) {
    query.stock = stock;
  }

  if (search) {
    query.title = {
      $regex: search,
      $options: "i",
    };
  }

  if (category) {
    query.category = category;
  }

  if (condition) {
    query.condition = condition;
  }

  const result = await productCollection
    .find(query)
    .sort({ _id: -1 })
    .toArray();

  res.send(result)
})
app.delete("/api/product/:id",verifyToken,verifyseller, async (req, res) => {
  const id = req.params.id;

  const result = await productCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});

app.patch("/api/product/:id", verifyToken,verifyseller,async (req, res) => {
  const id = req.params.id;
  const updatedData = req.body;

  const result = await productCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: updatedData,
    }
  );

  res.send(result);
});

app.post("/api/orders", async (req, res) => {
  const order = req.body;

  const result = await orderCollection.insertOne({
    ...order,
    status: "pending",
    createdAt: new Date(),
  });

  res.send(result);
});


app.get("/api/orders/:id",verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        success: false,
        message: "Invalid Order ID",
      });
    }

    const order = await orderCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!order) {
      return res.status(404).send({
        success: false,
        message: "Order not found",
      });
    }

    res.send(order);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: "Failed to fetch order",
    });
  }
});
app.patch("/api/orders/:id",verifyToken,verifyseller, async (req, res) => {
  try {
    const id = req.params.id;
    const { status } = req.body;

    const order = await orderCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!order) {
      return res.status(404).send({
        message: "Order not found",
      });
    }

    const updateData = {
      status,
    };

    // ==========================
    // ACCEPT ORDER
    // ==========================
    if (
      status === "accepted" &&
      order.status === "pending"
    ) {
      const product =
        await productCollection.findOne({
          _id: new ObjectId(
            order.productId
          ),
        });

      if (!product) {
        return res.status(404).send({
          message:
            "Product not found",
        });
      }

      if (
        Number(product.stock) <= 0
      ) {
        return res.status(400).send({
          message:
            "Product out of stock",
        });
      }

      await productCollection.updateOne(
        {
          _id: new ObjectId(
            order.productId
          ),
        },
        {
          $inc: {
            stock: -1,
          },
        }
      );

      updateData.acceptedAt =
        new Date();
    }

    // ==========================
    // SHIPPED
    // ==========================
    if (
      status === "shipped" &&
      order.status === "accepted"
    ) {
      updateData.shippedAt =
        new Date();
    }

    // ==========================
    // DELIVERED
    // ==========================
    if (
      status === "delivered" &&
      order.status === "shipped"
    ) {
      updateData.deliveredAt =
        new Date();
    }

    // ==========================
    // CANCELLED
    // ==========================
    if (
      status === "cancelled"
    ) {
      // restore stock only if
      // already accepted

      if (
        order.status ===
        "accepted"
      ) {
        await productCollection.updateOne(
          {
            _id: new ObjectId(
              order.productId
            ),
          },
          {
            $inc: {
              stock: 1,
            },
          }
        );
      }

      updateData.cancelledAt =
        new Date();
    }

    // ==========================
    // REJECTED
    // ==========================
 if (
  status === "rejected" &&
  order.status === "pending"
) {
  updateData.rejectedAt = new Date();
}

    const result =
      await orderCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updateData,
        }
      );

    res.send({
      success: true,
      modifiedCount:
        result.modifiedCount,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
app.patch(
  "/api/orders/:id/deliver",
  verifyToken,
  async (req, res) => {
    const { id } = req.params;

    const order = await orderCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!order) {
      return res.status(404).send({
        message: "Order not found",
      });
    }

    if (order.status !== "shipped") {
      return res.status(400).send({
        message: "Order is not shipped yet",
      });
    }

    const result = await orderCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: "delivered",
          deliveredAt: new Date(),
        },
      }
    );

    res.send({
      modifiedCount: result.modifiedCount,
    });
  }
);
app.delete("/api/orders/:id", async (req, res) => {
  const id = req.params.id;

  const result = await orderCollection.deleteOne({
    _id: new ObjectId(id),
  });

  res.send(result);
});
app.get("/api/orders", async (req, res) => {
  const { sellerId, buyerId } = req.query;

  const query = {};

  if (sellerId) {
    query.sellerId = sellerId;
  }

  if (buyerId) {
    query.buyerId = buyerId;

    // Buyer won't see cancelled orders
    query.status = {
      $ne: "cancelled",
    };
  }

  const result = await orderCollection
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
 console.log(
    "STATUSES:",
    result.map((o) => o.status)
  );

  res.send(result);
});

app.patch("/api/orders/:id/remove-from-buyer-orders",verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user.id;

    const order = await orderCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!order) {
      return res.status(404).send({
        message: "Order not found",
      });
    }

    const result = await orderCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
             status: "cancelled",
          removedFromBuyerOrders: true,
        },
      }
    );

    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});
app.post("/api/users/google", async (req, res) => {
  const user = req.body;

  const existingUser = await userCollection.findOne({
    email: user.email,
  });

  if (existingUser) {
    return res.send(existingUser);
  }

  const newUser = {
    name: user.name,
    email: user.email,
    image: user.image,
    emailVerified: user.emailVerified,
    role: "buyer",
    createdAt: new Date(),
  };

  const result = await userCollection.insertOne(newUser);

  res.send(result);
});
app.get("/api/users", async (req, res) => {
  const { search = "", role = "" } = req.query;

  const query = {};

  if (search) {
    query.$or = [
      {
        name: {
          $regex: search,
          $options: "i",
        },
      },
      {
        email: {
          $regex: search,
          $options: "i",
        },
      },
    ];
  }

  if (role) {
    query.role = role;
  }

  const users = await userCollection
    .find(query)
    .sort({ _id: -1 })
    .toArray();

  res.send(users);
});

app.patch("/api/users/status/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const result = await userCollection.updateOne(
    {
      _id: new ObjectId(id),
    },
    {
      $set: {
        status,
      },
    }
  );

  res.send(result);
});
app.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid user id",
      });
    }

    const user = await userCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!user) {
      return res.status(404).send({
        message: "User not found",
      });
    }

    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({
      message: "Failed to fetch user",
    });
  }
});
app.patch("/api/users/:id",verifyToken,verifyseller, async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({
        message: "Invalid user id",
      });
    }

    const { phone, address, image } = req.body;

    const result = await userCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          phone,
          address,
          image,
        },
      }
    );

    res.send(result);
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Failed to update profile",
    });
  }
});
app.delete("/api/users/:id", async (req, res) => {
  const { id } = req.params;

  const result =
    await userCollection.deleteOne({
      _id: new ObjectId(id),
    });

  res.send(result);
});
app.patch("/api/users/profile/:id",verifyToken,verifybuyer, async (req, res) => {
  const { id } = req.params;
  const { name, phone, address } = req.body;
  console.log("params:", req.params);
  console.log("body:", req.body);
  const result = await userCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        name,
        phone,
        address,
        updatedAt: new Date(),
      },
    }
  );

res.status(200).json(result);
});
app.get("/api/categories", async (req, res) => {
  const categories = await productCollection
    .aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          count: 1,
        },
      },
    ])
    .toArray();

  res.send(categories);
});
app.get("/api/categories2", async (req, res) => {
  const categories = await productCollection.aggregate([
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: 0,
        name: "$_id",
        count: 1,
      },
    },
    { $limit: 5 } 
  ]).toArray();

  res.send(categories);
});
app.get("/api/products/category/:name", async (req, res) => {
  const category = req.params.name;




  const products = await productCollection
    .find({
      category: { $regex: new RegExp(`^${category}$`, "i") }
    })
    .toArray();

  res.send(products);
});

app.post("/api/create-checkout-session", async (req, res) => {
  const { product, buyerInfo, buyerId } = req.body;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],

    line_items: [
      {
        price_data: {
          currency: "bdt",
          product_data: {
            name: product.title,
          },
          unit_amount: (product.price + 100) * 100,
        },
        quantity: 1,
      },
    ],

    mode: "payment",

    success_url:
      `${process.env.BETTER_AUTH_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,

    cancel_url: `${process.env.BETTER_AUTH_URL}/Products/${product._id}`,


    metadata: {
      productId: product._id,
  productTitle: product.title,
  productPrice: String(product.price),
  productImage: product.image,

  sellerId: product.sellerId,

  buyerId,
  buyerName: buyerInfo.fullName,
  phone: buyerInfo.phone,
  address: buyerInfo.address,
    },
  });

  res.send({
    url: session.url,
  });
});

app.get("/api/create-order-from-session/:sessionId", async (req, res) => {
  const { sessionId } = req.params;

  try {
    const existingOrder = await orderCollection.findOne({
      stripeSessionId: sessionId,
    });
    const existingPayment =
  await paymentCollection.findOne({
    stripeSessionId: sessionId,
  });

if (existingPayment) {
  return res.send({
    success: true,
    message: "Payment already exists",
  });
}

    if (existingOrder) {
      return res.send({
        success: true,
        message: "Order already exists",
      });
    }

    const stripeSession =
      await stripe.checkout.sessions.retrieve(sessionId);

   const order = {
  stripeSessionId: sessionId,

  productId: stripeSession.metadata.productId,
  productTitle: stripeSession.metadata.productTitle,
  productImage: stripeSession.metadata.productImage,
  productPrice: Number(
    stripeSession.metadata.productPrice
  ),

  sellerId: stripeSession.metadata.sellerId,
  buyerId: stripeSession.metadata.buyerId,

  buyerName: stripeSession.metadata.buyerName,
  phone: stripeSession.metadata.phone,
  address: stripeSession.metadata.address,

  paymentStatus: "paid",
  status: "pending",

  createdAt: new Date(),
};

   const orderResult =
  await orderCollection.insertOne(order);
  const payment = {
  transactionId:
    stripeSession.payment_intent,

  stripeSessionId: sessionId,

  orderId:
    orderResult.insertedId.toString(),

  productId:
    stripeSession.metadata.productId,

  buyerId:
    stripeSession.metadata.buyerId,

  sellerId:
    stripeSession.metadata.sellerId,

  amount:
    stripeSession.amount_total / 100,

  paymentMethod: "card",

  paymentStatus: "paid",

  paymentDate: new Date(),

  createdAt: new Date(),
};

await paymentCollection.insertOne(payment);

    res.send({
      success: true,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/seller/dashboard/:sellerId", async (req, res) => {
  const { sellerId } = req.params;

  const products = await productCollection
    .find({ sellerId })
    .toArray();

  const orders = await orderCollection
    .find({ sellerId })
    .toArray();

  const totalProducts = products.length;

  const totalSales = orders.filter(
    (o) => o.status === "delivered"
  ).length;

  const pendingOrders = orders.filter(
    (o) => o.status === "pending"
  ).length;

  const totalRevenue = orders
    .filter((o) => o.status === "delivered")
    .reduce(
      (sum, order) =>
        sum + (order.productPrice || 0),
      0
    );

  res.send({
    totalProducts,
    totalSales,
    totalRevenue,
    pendingOrders,
  });
});

app.post("/api/wishlist", async (req, res) => {
  const {
    productId,
    buyerId,
    title,
    image,
    price,
    condition,
  } = req.body;

  const existing =
    await wishlistCollection.findOne({
      productId,
      buyerId,
    });

  if (existing) {
    return res.send({
      success: false,
      message: "Already wishlisted",
    });
  }

  const result =
    await wishlistCollection.insertOne({
      productId,
      buyerId,
      title,
      image,
      price,
      condition,
      createdAt: new Date(),
    });

  res.send(result);
});
app.get("/api/wishlist", async (req, res) => {
  const { buyerId } = req.query;

  const result =
    await wishlistCollection
      .find({ buyerId })
      .toArray();

  res.send(result);
});
app.delete("/api/wishlist/:id", async (req, res) => {
  const { id } = req.params;

  const result =
    await wishlistCollection.deleteOne({
      _id: new ObjectId(id),
    });

  res.send(result);
});


app.get("/api/marketplace-stats", async (req, res) => {
  try {
    const totalProducts =
      await productCollection.countDocuments();

    const totalSellers =
      await userCollection.countDocuments({
        role: "seller",
      });

    const totalBuyers =
      await userCollection.countDocuments({
        role: "buyer",
      });

    const completedOrders =
      await orderCollection.countDocuments({
        status: "delivered",
      });

    res.send({
      totalProducts,
      totalSellers,
      totalBuyers,
      completedOrders,
    });
  } catch (error) {
    res.status(500).send({
      message: error.message,
    });
  }
});

app.get("/api/payments", async (req, res) => {
  const { buyerId } = req.query;

  const result = await paymentCollection
    .find({ buyerId })
    .sort({ _id: -1 })
    .toArray();

  res.send(result);
});
app.get("/api/admin/stats",verifyToken,verifyAdmin,async(req,res)=>{
  try {
    const totalUsers =
      await userCollection.countDocuments();

    const totalProducts =
      await productCollection.countDocuments();

    const totalOrders =
      await orderCollection.countDocuments();

    const totalRevenueResult =
      await paymentCollection.aggregate([
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$amount",
            },
          },
        },
      ]).toArray();

    const totalRevenue =
      totalRevenueResult[0]?.totalRevenue || 0;

    res.send({
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
    });
  } catch (error) {
    res.status(500).send({
      success: false,
      message: error.message,
    });
  }
});

app.get("/api/admin/products", verifyToken,async (req, res) => {
      console.log("QUERY:", req.query);
  try {
    const search = req.query.search?.trim() || "";
    const status = req.query.status?.trim() || "";

    const query = {};

    if (search) {
      query.title = {
        $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        $options: "i",
      };
    }

   if (status) {
  query.status = { $regex: `^${status}$`, $options: "i" };
}

    const products = await productCollection
      .find(query)
      .sort({ _id: -1 })
      .toArray();

    res.status(200).send(products);
  } catch (error) {
    console.error("Admin products error:", error);
    res.status(500).send({
      message: "Failed to fetch products",
    });
  }
});
app.get("/api/admin/users",verifyToken,verifyAdmin, async (req, res) => {
  const users = await userCollection
    .find({})
    .sort({ _id: -1 })
    .toArray();

  res.send(users);
});

app.patch(
  "/api/admin/users/:id/status",
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const result =
      await userCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: { status },
        }
      );

    res.send(result);
  }
);

app.delete(
  "/api/admin/users/:id",verifyToken,verifyAdmin,
  async (req, res) => {
    const { id } = req.params;

    const result =
      await userCollection.deleteOne({
        _id: new ObjectId(id),
      });

    res.send(result);
  }
);
app.patch(
  "/api/admin/products/:id/approve",
  async (req, res) => {
    const { id } = req.params;

    const result =
      await productCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status: "approved",
          },
        }
      );

    res.send(result);
  }
);
app.patch(
  "/api/admin/products/:id/reject",
  async (req, res) => {
    const { id } = req.params;

    const result =
      await productCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            status: "rejected",
          },
        }
      );

    res.send(result);
  }
);
app.delete(
  "/api/admin/products/:id",
  async (req, res) => {
    const { id } = req.params;

    const result =
      await productCollection.deleteOne({
        _id: new ObjectId(id),
      });

    res.send(result);
  }
);
app.get(
  "/api/admin/reports",verifyToken,verifyAdmin,
  async (req, res) => {
    const reports =
      await reportCollection
        .find()
        .sort({
          createdAt: -1,
        })
        .toArray();

    res.send(reports);
  }
);

app.post(
  "/api/reports",
  async (req, res) => {
    const report = req.body;
const existing =
      await reportCollection.findOne({
        productId:
          report.productId,
        reporterId:
          report.reporterId,
      });

    if (existing) {
      return res.send({
        success: false,
        message:
          "You already reported this product",
      });
    }
    const result =
      await reportCollection.insertOne({
        ...report,
        status: "pending",
        createdAt: new Date(),
      });

    res.send({
      success: true,
      insertedId:
        result.insertedId,
    });
  }
);
app.get(
  "/api/admin/orders",verifyToken,verifyAdmin,
  async (req, res) => {
    const orders =
      await orderCollection
        .find()
        .sort({ _id: -1 })
        .toArray();

    res.send(orders);
  }
);
app.patch(
  "/api/admin/orders/:id/status",verifyToken,verifyAdmin,
  async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const result =
      await orderCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: {
            orderStatus: status,
          },
        }
      );

    res.send(result);
  }
);
app.patch("/api/orders/:id/dispute", async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const result = await orderCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        "dispute.isDisputed": true,
        "dispute.reason": reason,
        "dispute.status": "open",
      },
    }
  );

  res.send(result);
});
app.patch("/api/admin/orders/:id/dispute/resolve", async (req, res) => {
  const { id } = req.params;

  const result = await orderCollection.updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        "dispute.status": "resolved",
      },
    }
  );

  res.send(result);
});
    // await client.db("admin").command({ ping: 1 });
//     console.log("Pinged your deployment. You successfully connected to MongoDB!");
//   } finally {
   
  
//   }
// }
// run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

module.exports = app