// javascript
// filepath: backend/checkUser.js

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();
const User = require("./models/User");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/spotails", {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    const email = "blaisesogoyou@gmail.com"; // <-- remplacez par votre email
    const plain = "Toro77600"; // <-- remplacez par votre mot de passe
    const user = await User.findOne({ email: email.toLowerCase() }).lean();
    console.log("User found:", !!user);
    if (!user) return process.exit(0);
    console.log("Stored email:", user.email);
    console.log("Stored password (prefix):", (user.password || "").slice(0, 30));
    const match = await bcrypt.compare(plain, user.password || "");
    console.log("bcrypt.compare =>", match);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();