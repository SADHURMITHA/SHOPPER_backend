const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const dotenv = require("dotenv");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

dotenv.config();

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
  cartData: Object,
  date: { type: Date, default: Date.now },
});

const Product = mongoose.model("Product", {
  id: Number,
  name: String,
  description: String,
  image: String, // CLOUDINARY URL
  category: String,
  new_price: Number,
  old_price: Number,
  date: { type: Date, default: Date.now },
  avilable: { type: Boolean, default: true },
});

const Orders = mongoose.model("Orders",{
  orderId:String,
  items:Array,
  totalAmount:Number,
  paymentMethod:String,
  date:{type:Date,default:Date.now}
});

/* -------------------- Auth Middleware -------------------- */
const fetchuser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) return res.status(401).send({ errors: "Auth failed" });

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data.user;
    next();
  } catch {
    res.status(401).send({ errors: "Auth failed" });
  }
};


/* -------------------- Routes -------------------- */
app.get("/", (req, res) => res.send("API Running"));


// endpoint for getting latest products data
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

/* ---------- MERGED ADD PRODUCT ---------- */
app.post("/addproduct", upload.single("product"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Image required" });
    }

    const products = await Product.find({});
    const id = products.length ? products[products.length - 1].id + 1 : 1;
    console.log(req.file.path)
    const product = new Product({
      id,
      name: req.body.name,
      description: req.body.description,
      image: req.file.path, // ✅ CLOUDINARY URL
      category: req.body.category,
      new_price: req.body.new_price,
      old_price: req.body.old_price,
    });

    await product.save();

    res.json({
      success: true,
      product,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ---------- Remove Product ---------- */
app.post("/removeproduct", async (req, res) => {
  try {
    const { id } = req.body;
    console.log(id)
    const product = await Product.findOneAndDelete({ id: id });

    if (!product) {
      return res.json({
        success: false,
        message: "Product not found",
      });
    }

    res.json({
      success: true,
      message: "Product removed successfully",
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/* ---------- Products ---------- */
app.get("/allproducts", async (req, res) => {
  res.json(await Product.find({}));
});

/* CREATE ORDER */
app.post("/createorder",async(req,res)=>{
  try{

    const {items,totalAmount,paymentMethod}=req.body;

    const orderId="ORD"+Date.now();

    const order=new Orders({
      orderId,
      items,
      totalAmount,
      paymentMethod
    });

    await order.save();

    res.json({success:true,order});

  }catch(err){
    console.error(err);
    res.status(500).json({success:false});
  }
});

/* GET ORDERS */
app.get("/myorders",async(req,res)=>{
  res.json(await Orders.find({}));
});

/* -------------------- Server -------------------- */
app.listen(port, () => {
  console.log("🔥 Cloudinary server running on port " + port);
});
