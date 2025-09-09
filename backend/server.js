const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
require("dotenv").config();
const fs = require("fs");
const path = require("path");

const app = express();

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

connectDB().then(() =>{} );

app.use(cors());
app.use(express.json());

app.use("/api/cocktails", require("./routes/cocktails"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/users", require("./routes/users"));
app.use("/api/spotify", require("./routes/spotify"));

app.use('/uploads', express.static('uploads'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
