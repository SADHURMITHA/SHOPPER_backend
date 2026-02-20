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
  .then(() => console.log("Mongo connected successfully"))
  .catch((err) => console.log(err.message));

/* -------------------- Cloudinary Config -------------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* -------------------- Multer Cloudinary -------------------- */
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
  role: {
    type: String,
    default: "user", // user or admin
  },
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
  date: { type: Date, default: Date.now },
  avilable: { type: Boolean, default: true },
});

const Orders = mongoose.model("Orders", {
  orderId: String,
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  items: Array,
  totalAmount: Number,
  paymentMethod: String,
  status: {
    type: String,
    default: "Pending",
  },
  date: { type: Date, default: Date.now },
});

/* -------------------- AUTH MIDDLEWARE -------------------- */

const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");

  if (!token)
    return res.status(401).json({ errors: "Auth failed" });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);

    const user = await Users.findById(data.user.id);

    if (!user)
      return res.status(401).json({ errors: "User not found" });

    req.user = user;

    next();
  } catch {
    res.status(401).json({ errors: "Invalid token" });
  }
};


/* -------------------- Routes -------------------- */

app.get("/", (req, res) => res.send("API Running"));

/* ---------- ADD PRODUCT ---------- */
app.post("/addproduct", upload.single("product"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "Image required" });

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

// Create an endpoint at ip/login for login the user and giving auth-token
app.post('/login', async (req, res) => {
  console.log("Login");
  let success = false;
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id
        }
      }
      success = true;
      console.log(user.id);
      const token = jwt.sign(data, 'secret_ecom');
      res.json({ success, token });
    }
    else {
      return res.status(400).json({ success: success, errors: "please try with correct email/password" })
    }
  }
  else {
    return res.status(400).json({ success: success, errors: "please try with correct email/password" })
  }
})


//Create an endpoint at ip/auth for regestring the user & sending auth-token
app.post('/signup', async (req, res) => {
  console.log("Sign Up");
  let success = false;
  let check = await Users.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({ success: success, errors: "existing user found with this email" });
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
    user: {
      id: user.id
    }
  }

  const token = jwt.sign(data, 'secret_ecom');
  success = true;
  res.json({ success, token })
})


/* ---------- ALL PRODUCTS ---------- */
app.get("/allproducts", async (req, res) => {
  res.json(await Product.find({}));
});

/* ---------- CREATE ORDER (USER) ---------- */
app.post("/createorder", fetchuser, async (req, res) => {
  try {
    const { items, totalAmount, paymentMethod } = req.body;

    const orderId = "ORD" + Date.now();

    const order = new Orders({
      orderId,
      userId: req.user._id,
      items,
      totalAmount,
      paymentMethod,
    });

    await order.save();

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* ---------- USER'S OWN ORDERS ---------- */
app.get("/myorders", fetchuser, async (req, res) => {
  const orders = await Orders.find({
    userId: req.user._id,
  });

  res.json(orders);
});

/* ---------- ADMIN: GET ALL ORDERS ---------- */
app.get("/admin/orders", async (req, res) => {
  const orders = await Orders.find().populate("userId", "name email");

  res.json(orders);
});

/* ---------- ADMIN: UPDATE ORDER STATUS ---------- */
app.put("/admin/updateorder/:id", async (req, res) => {
  try {
    const { status } = req.body;

    const order = await Orders.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

/* -------------------- Server -------------------- */
app.listen(port, () => {
  console.log("🔥 Server running on port " + port);
});