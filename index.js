require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

/* -------------------- MongoDB -------------------- */
mongoose
  .connect(process.env.DB_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.log(err.message));

/* -------------------- Cloudinary -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* -------------------- Multer -------------------- */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["jpg", "png", "jpeg"],
  },
});

const upload = multer({ storage });

/* -------------------- Models -------------------- */

const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" },
  cartData: Object,
  date: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", {
  id: Number,
  name: String,
  description: String,
  image: String,
  category: String,
  new_price: Number,
  old_price: Number,
  available: { type: Boolean, default: true },
  date: { type: Date, default: Date.now },
});

const Orders = mongoose.model("Orders", {
  orderId: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Users" },
  items: [
    {
      productId: Number,
      name: String,
      image: String,   // ✅ ADD THIS
      price: Number,
      quantity: Number,
    }
  ],
  totalAmount: Number,
  paymentMethod: String,
  status: { type: String, default: "Pending" },
  date: { type: Date, default: Date.now },
});

/* -------------------- AUTH MIDDLEWARE -------------------- */
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");

  if (!token) {
    return res.status(401).json({ errors: "Auth failed" });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    const user = await Users.findById(data.user.id);

    if (!user) {
      return res.status(401).json({ errors: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ errors: "Invalid token" });
  }
};

/* -------------------- Routes -------------------- */

app.get("/", (req, res) => {
  res.send("🔥 API Running");
});

/* ---------- SIGNUP ---------- */
app.post("/signup", async (req, res) => {
  let success = false;

  const check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success, errors: "User already exists" });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();

  const data = {
    user: { id: user.id },
  };

  const token = jwt.sign(data, process.env.JWT_SECRET);
  success = true;

  res.json({ success, token });
});

/* ---------- LOGIN ---------- */
app.post("/login", async (req, res) => {
  let success = false;

  const user = await Users.findOne({ email: req.body.email });
  if (!user) {
    return res.status(400).json({ success, errors: "Invalid credentials" });
  }

  if (req.body.password !== user.password) {
    return res.status(400).json({ success, errors: "Invalid credentials" });
  }

  const data = {
    user: { id: user.id },
  };

  const token = jwt.sign(data, process.env.JWT_SECRET);
  success = true;

  res.json({ success, token });
});

/* ---------- ADD PRODUCT ---------- */
app.post("/addproduct", upload.single("product"), async (req, res) => {
  try {
    const products = await Product.find({});
    const id = products.length ? products[products.length - 1].id + 1 : 1;

    const product = new Product({
      id,
      name: req.body.name,
      description: req.body.description,
      image: req.file.path,
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    await product.save();
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- ALL PRODUCTS ---------- */
app.get("/allproducts", async (req, res) => {
  res.json(await Product.find({}));
});


// Popular

app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  let arr = products.slice(0).slice(-8);
  console.log("New Collections");
  res.send(arr);
});

// endpoint for getting womens products data
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "women" });
  let arr = products.splice(0, 4);
  console.log("Popular In Women");
  res.send(arr);
});

// endpoint for getting womens products data
app.post("/relatedproducts", async (req, res) => {
  console.log("Related Products");
  const {category} = req.body;
  const products = await Product.find({ category });
  const arr = products.slice(0, 4);
  res.send(arr);
});


/* ---------- CREATE ORDER ---------- */
app.post("/createorder", fetchuser, async (req, res) => {
  const { items, totalAmount, paymentMethod } = req.body;

  console.log(req.user._id);
  
  const order = new Orders({
    orderId: "ORD" + Date.now(),
    userId: req.user._id,
    items,
    totalAmount,
    paymentMethod,
  });

  await order.save();
  res.json({ success: true, order });
});

// Create an endpoint for saving the product in cart
app.post('/addtocart', fetchuser, async (req, res) => {
  console.log("Add Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Added")
})


// Create an endpoint for removing the product in cart
app.post('/removefromcart', fetchuser, async (req, res) => {
  console.log("Remove Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] != 0) {
    userData.cartData[req.body.itemId] -= 1;
  }
  await Users.findOneAndUpdate({ _id: req.user.id }, { cartData: userData.cartData });
  res.send("Removed");
})

app.post('/getcart', fetchuser, async (req, res) => {
  console.log("Get Cart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);

})


/* ---------- MY ORDERS ---------- */
app.get("/myorders", fetchuser, async (req, res) => {
  const orders = await Orders.find({ userId: req.user._id });
  res.json(orders);
});

/* ---------- ADMIN ORDERS ---------- */
app.get("/admin/orders", async (req, res) => {
  const orders = await Orders.find().populate("userId", "name email");
  res.json(orders);
});

/* ---------- UPDATE ORDER STATUS ---------- */
// PATCH – Update order status (UNPROTECTED)
app.patch("/admin/order/status/:orderId", async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Orders.findByIdAndUpdate(
      req.params.orderId,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});
/* -------------------- Server -------------------- */
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});